/** Helpers server-only do módulo de Cartões de ponto. */
import type { TimesheetSummary } from "./timesheet.shared";

type AnyClient = {
  from: (table: string) => any;
};

export type BuiltEntry = {
  work_date: string;
  clock_in: string | null;
  break_start: string | null;
  break_end: string | null;
  clock_out: string | null;
  planned_minutes: number;
  worked_minutes: number;
  overtime_minutes: number;
  delay_minutes: number;
  absence_status: string | null;
  alerts: string[];
  notes: string | null;
  source: string;
};

const MIN = 60_000;

function dateKey(iso: string, timeZone: string) {
  // "2026-08-30" na zona da unidade.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return parts;
}

export function eachDate(start: string, end: string) {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function diffMinutes(a?: string | null, b?: string | null) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / MIN));
}

/**
 * Monta os lançamentos diários de um colaborador a partir dos registros de
 * ponto e da escala publicada. Não inventa dados: dias sem batida ficam
 * marcados como sem registro.
 */
export function buildEntries(input: {
  dates: string[];
  timeZone: string;
  punches: { entry_type: string; server_time: string }[];
  blocks: { work_date: string; start_at: string; end_at: string }[];
}): { entries: BuiltEntry[]; summary: TimesheetSummary } {
  const byDate = new Map<string, { entry_type: string; server_time: string }[]>();
  for (const p of input.punches) {
    const key = dateKey(p.server_time, input.timeZone);
    const list = byDate.get(key) ?? [];
    list.push(p);
    byDate.set(key, list);
  }

  const plannedByDate = new Map<string, number>();
  const scheduleStart = new Map<string, string>();
  for (const b of input.blocks) {
    plannedByDate.set(b.work_date, (plannedByDate.get(b.work_date) ?? 0) + diffMinutes(b.start_at, b.end_at));
    if (!scheduleStart.has(b.work_date)) scheduleStart.set(b.work_date, b.start_at);
  }

  const entries: BuiltEntry[] = [];
  const summary: TimesheetSummary = {
    planned_minutes: 0,
    worked_minutes: 0,
    overtime_minutes: 0,
    late_minutes: 0,
    absence_days: 0,
    balance_minutes: 0,
    missing_punches: 0,
    alerts: [],
  };

  for (const date of input.dates) {
    const punches = (byDate.get(date) ?? []).sort(
      (a, b) => new Date(a.server_time).getTime() - new Date(b.server_time).getTime(),
    );
    const planned = plannedByDate.get(date) ?? 0;
    const alerts: string[] = [];

    const pick = (type: string) => punches.find((p) => p.entry_type === type)?.server_time ?? null;
    const clockIn = pick("entrada");
    const breakStart = pick("intervalo_saida");
    const breakEnd = pick("intervalo_retorno");
    const clockOut = pick("saida");

    for (const type of ["entrada", "intervalo_saida", "intervalo_retorno", "saida"]) {
      if (punches.filter((p) => p.entry_type === type).length > 1) alerts.push("registro_duplicado");
    }

    let worked = 0;
    if (clockIn && clockOut) {
      worked = diffMinutes(clockIn, clockOut) - diffMinutes(breakStart, breakEnd);
    } else if (clockIn) {
      alerts.push("batida_faltante");
    }
    if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) alerts.push("intervalo_incompleto");

    const missing = [clockIn, clockOut].filter((v) => !v).length;
    let absence: string | null = null;
    if (punches.length === 0) {
      absence = planned > 0 ? "falta" : "folga";
      if (planned > 0) alerts.push("sem_dados");
    }
    if (planned > 0 && worked > planned * 2) alerts.push("jornada_fora_config");

    const delay =
      clockIn && scheduleStart.has(date)
        ? Math.max(0, Math.round((new Date(clockIn).getTime() - new Date(scheduleStart.get(date)!).getTime()) / MIN))
        : 0;
    const overtime = planned > 0 ? Math.max(0, worked - planned) : 0;

    const unique = Array.from(new Set(alerts));
    entries.push({
      work_date: date,
      clock_in: clockIn,
      break_start: breakStart,
      break_end: breakEnd,
      clock_out: clockOut,
      planned_minutes: planned,
      worked_minutes: worked,
      overtime_minutes: overtime,
      delay_minutes: delay,
      absence_status: absence,
      alerts: unique,
      notes: null,
      source: "registros",
    });

    summary.planned_minutes += planned;
    summary.worked_minutes += worked;
    summary.overtime_minutes += overtime;
    summary.late_minutes += delay;
    summary.missing_punches += punches.length > 0 ? missing : 0;
    if (absence === "falta") summary.absence_days += 1;
    for (const a of unique) if (!summary.alerts.includes(a)) summary.alerts.push(a);
  }

  summary.balance_minutes = summary.worked_minutes - summary.planned_minutes;
  return { entries, summary };
}

/** Registra um evento de auditoria do cartão de ponto. */
export async function logCardEvent(
  client: AnyClient,
  payload: {
    company_id: string;
    card_id?: string | null;
    period_id?: string | null;
    batch_id?: string | null;
    actor_type?: string;
    actor_id?: string | null;
    actor_label?: string | null;
    event_type: string;
    metadata?: Record<string, unknown>;
  },
) {
  await client.from("point_card_events").insert({
    actor_type: payload.actor_type ?? "gestor",
    metadata: payload.metadata ?? {},
    ...payload,
  });
}

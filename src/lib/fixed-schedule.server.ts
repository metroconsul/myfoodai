/**
 * Jornada fixa (server-only).
 *
 * Materializa a jornada configurada da unidade em `schedules`/`schedule_blocks`
 * com `source = 'fixed_schedule'`, para que o motor de cartão de ponto continue
 * calculando previsto, atrasos e faltas sem expor a tela de escalas.
 */

const TZ_OFFSET = "-03:00"; // horário de Brasília

export interface FixedSchedule {
  id: string;
  company_id: string;
  unit_id: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  active: boolean;
}

function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Minutos previstos por dia, já descontando o intervalo configurado. */
export function plannedMinutesOf(schedule: FixedSchedule): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":");
    return Number(h) * 60 + Number(m);
  };
  let total = toMin(schedule.end_time) - toMin(schedule.start_time);
  if (total < 0) total += 24 * 60;
  if (schedule.break_start && schedule.break_end) {
    total -= Math.max(0, toMin(schedule.break_end) - toMin(schedule.break_start));
  }
  return Math.max(0, total);
}

/** Datas de trabalho previstas no período, conforme os dias da semana da jornada. */
export function plannedDates(schedule: FixedSchedule, start: string, end: string): string[] {
  return eachDate(start, end).filter((date) => {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = domingo
    return schedule.weekdays.includes(weekday);
  });
}

export async function getFixedScheduleForUnit(unitId: string): Promise<FixedSchedule | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("fixed_work_schedules")
    .select("id, company_id, unit_id, weekdays, start_time, end_time, break_start, break_end, active")
    .eq("unit_id", unitId)
    .eq("active", true)
    .maybeSingle();
  return (data as FixedSchedule | null) ?? null;
}

/**
 * Garante os blocos previstos do período para um colaborador.
 * Idempotente: nunca duplica blocos já existentes na mesma data.
 */
export async function materializeFixedSchedule(input: {
  companyId: string;
  unitId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{ created: number; plannedMinutesPerDay: number } | null> {
  const schedule = await getFixedScheduleForUnit(input.unitId);
  if (!schedule) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const scheduleName = `Jornada fixa ${input.periodStart} a ${input.periodEnd}`;
  const { data: existingSchedule } = await supabaseAdmin
    .from("schedules")
    .select("id")
    .eq("unit_id", input.unitId)
    .eq("source", "fixed_schedule")
    .eq("period_start", input.periodStart)
    .eq("period_end", input.periodEnd)
    .maybeSingle();

  let scheduleId = existingSchedule?.id ?? null;
  if (!scheduleId) {
    const { data: created, error } = await supabaseAdmin
      .from("schedules")
      .insert({
        company_id: input.companyId,
        unit_id: input.unitId,
        name: scheduleName,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        status: "publicada",
        source: "fixed_schedule",
      })
      .select("id")
      .single();
    if (error || !created) throw new Error("Não foi possível preparar a jornada fixa do período.");
    scheduleId = created.id;
  }

  const dates = plannedDates(schedule, input.periodStart, input.periodEnd);
  const { data: existingBlocks } = await supabaseAdmin
    .from("schedule_blocks")
    .select("work_date")
    .eq("employee_id", input.employeeId)
    .gte("work_date", input.periodStart)
    .lte("work_date", input.periodEnd);
  const already = new Set((existingBlocks ?? []).map((b) => b.work_date));

  const rows = dates
    .filter((date) => !already.has(date))
    .map((date) => {
      const startAt = `${date}T${schedule.start_time.slice(0, 5)}:00${TZ_OFFSET}`;
      const crosses = schedule.end_time < schedule.start_time;
      const endDate = crosses
        ? new Date(new Date(`${date}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
        : date;
      const endAt = `${endDate}T${schedule.end_time.slice(0, 5)}:00${TZ_OFFSET}`;
      return {
        company_id: input.companyId,
        unit_id: input.unitId,
        schedule_id: scheduleId!,
        employee_id: input.employeeId,
        work_date: date,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        notes: "Jornada fixa",
      };
    });

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from("schedule_blocks").insert(rows);
    if (error) throw new Error("Não foi possível gerar a jornada prevista do período.");
  }

  return { created: rows.length, plannedMinutesPerDay: plannedMinutesOf(schedule) };
}

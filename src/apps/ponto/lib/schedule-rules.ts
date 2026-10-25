import { localYmd } from "./dates";

/** Regras puras da escala semanal (sem banco), usadas pela tela Escalas e cobertas por testes. */

export const MIN_REST_MINUTES = 11 * 60;
export const WEEKLY_LIMIT_MINUTES = 44 * 60;

export type Block = { id: string; employee_id: string; work_date: string; start_at: string; end_at: string };

/** As 7 datas (seg → dom) da semana que começa em `monday` (AAAA-MM-DD). */
export function weekDates(monday: string): string[] {
  const [y, m, d] = monday.split("-").map(Number) as [number, number, number];
  return Array.from({ length: 7 }, (_, i) => localYmd(new Date(y, m - 1, d + i)));
}

/** Segunda-feira da semana de `date`. */
export function mondayOf(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localYmd(d);
}

export function shiftWeek(monday: string, weeks: number): string {
  const [y, m, d] = monday.split("-").map(Number) as [number, number, number];
  return localYmd(new Date(y, m - 1, d + 7 * weeks));
}

export const minutesOf = (b: Pick<Block, "start_at" | "end_at">) =>
  Math.max(0, (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000);

/** Início/fim em ISO a partir de data e horários locais; fim antes do início vira o dia seguinte. */
export function blockTimes(date: string, start: string, end: string): { start_at: string; end_at: string } {
  const s = new Date(`${date}T${start}:00`);
  const e = new Date(`${date}T${end}:00`);
  if (e <= s) e.setDate(e.getDate() + 1);
  return { start_at: s.toISOString(), end_at: e.toISOString() };
}

export type Warning = { employeeId: string; kind: "sobreposicao" | "descanso" | "carga"; minutes: number; at?: string };

/** Avisos da semana: horários sobrepostos, descanso menor que 11h e mais de 44h na semana. */
export function weekWarnings(blocks: Block[]): Warning[] {
  const byEmployee = new Map<string, Block[]>();
  for (const b of blocks) byEmployee.set(b.employee_id, [...(byEmployee.get(b.employee_id) ?? []), b]);
  const out: Warning[] = [];
  for (const [employeeId, list] of byEmployee) {
    const sorted = [...list].sort((a, b) => a.start_at.localeCompare(b.start_at));
    let total = 0;
    sorted.forEach((b, i) => {
      total += minutesOf(b);
      const next = sorted[i + 1];
      if (!next) return;
      const gap = (new Date(next.start_at).getTime() - new Date(b.end_at).getTime()) / 60000;
      if (gap < 0) out.push({ employeeId, kind: "sobreposicao", minutes: -gap, at: next.start_at });
      else if (gap < MIN_REST_MINUTES) out.push({ employeeId, kind: "descanso", minutes: gap, at: next.start_at });
    });
    if (total > WEEKLY_LIMIT_MINUTES) out.push({ employeeId, kind: "carga", minutes: total });
  }
  return out;
}

/**
 * Blocos da semana anterior levados 7 dias à frente, só onde o colaborador ainda não tem horário no dia.
 * Devolve os horários a inserir (sem ids).
 */
export function copyFromPreviousWeek(previous: Block[], current: Pick<Block, "employee_id" | "work_date">[]) {
  const taken = new Set(current.map((b) => `${b.employee_id}|${b.work_date}`));
  const week = 7 * 86_400_000;
  return previous
    .map((b) => {
      const [y, m, d] = b.work_date.split("-").map(Number) as [number, number, number];
      return {
        employee_id: b.employee_id,
        work_date: localYmd(new Date(y, m - 1, d + 7)),
        start_at: new Date(new Date(b.start_at).getTime() + week).toISOString(),
        end_at: new Date(new Date(b.end_at).getTime() + week).toISOString(),
      };
    })
    .filter((b) => !taken.has(`${b.employee_id}|${b.work_date}`));
}

import { describe, expect, it } from "vitest";
import { blockTimes, copyFromPreviousWeek, mondayOf, shiftWeek, weekDates, weekWarnings, type Block } from "./schedule-rules";

const b = (employee_id: string, date: string, start: string, end: string, id = `${employee_id}${date}${start}`): Block => ({
  id,
  employee_id,
  work_date: date,
  ...blockTimes(date, start, end),
});

describe("semana", () => {
  it("acha a segunda e as 7 datas", () => {
    expect(mondayOf(new Date(2026, 9, 24))).toBe("2026-10-19"); // sábado
    expect(mondayOf(new Date(2026, 9, 25))).toBe("2026-10-19"); // domingo
    expect(mondayOf(new Date(2026, 9, 19))).toBe("2026-10-19"); // segunda
    expect(weekDates("2026-10-26")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(shiftWeek("2026-10-19", -1)).toBe("2026-10-12");
  });

  it("horário que passa da meia-noite termina no dia seguinte", () => {
    const t = blockTimes("2026-10-24", "22:00", "06:00");
    expect((new Date(t.end_at).getTime() - new Date(t.start_at).getTime()) / 3_600_000).toBe(8);
  });
});

describe("avisos", () => {
  it("semana normal não gera aviso", () => {
    const blocks = ["19", "20", "21", "22", "23"].map((d) => b("ana", `2026-10-${d}`, "08:00", "16:00"));
    expect(weekWarnings(blocks)).toEqual([]);
  });
  it("aponta sobreposição, descanso curto e carga acima de 44h", () => {
    const over = [b("ana", "2026-10-19", "08:00", "16:00"), b("ana", "2026-10-19", "15:00", "18:00")];
    expect(weekWarnings(over).map((w) => w.kind)).toEqual(["sobreposicao"]);
    const rest = [b("bia", "2026-10-19", "14:00", "23:00"), b("bia", "2026-10-20", "06:00", "12:00")];
    expect(weekWarnings(rest).map((w) => [w.kind, w.minutes])).toEqual([["descanso", 420]]);
    const long = ["19", "20", "21", "22", "23", "24"].map((d) => b("caio", `2026-10-${d}`, "08:00", "16:00"));
    expect(weekWarnings(long)).toEqual([{ employeeId: "caio", kind: "carga", minutes: 48 * 60 }]);
  });
});

describe("copiar semana anterior", () => {
  it("leva 7 dias à frente e não sobrescreve dia já preenchido", () => {
    const prev = [b("ana", "2026-10-12", "08:00", "16:00"), b("ana", "2026-10-13", "08:00", "16:00")];
    const rows = copyFromPreviousWeek(prev, [{ employee_id: "ana", work_date: "2026-10-20" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.work_date).toBe("2026-10-19");
    expect(rows[0]!.start_at).toBe(blockTimes("2026-10-19", "08:00", "16:00").start_at);
  });
});

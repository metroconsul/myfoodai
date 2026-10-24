import { describe, expect, it } from "vitest";
import {
  addDays,
  expectedByMethod,
  formatBRL,
  movementEffect,
  parseBRL,
  periodRange,
  periodResult,
  sumMoney,
} from "./money";

describe("dinheiro", () => {
  it("formata em reais", () => {
    expect(formatBRL(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(formatBRL(null).replace(/\s/g, " ")).toBe("R$ 0,00");
  });

  it("entende o que o usuário digita", () => {
    expect(parseBRL("1.234,56")).toBe(1234.56);
    expect(parseBRL("1234,5")).toBe(1234.5);
    expect(parseBRL("1234.56")).toBe(1234.56);
    expect(parseBRL("R$ 10")).toBe(10);
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("")).toBeNull();
  });

  it("soma sem erro de ponto flutuante", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(["10.10", 20.2, null])).toBe(30.3);
  });
});

describe("caixa", () => {
  const cash = "pm-cash";
  const pix = "pm-pix";
  const movements = [
    { type: "sale" as const, amount: 100, payment_method_id: cash, reversal_of: null },
    { type: "sale" as const, amount: 50, payment_method_id: pix, reversal_of: null },
    { type: "expense" as const, amount: 20, payment_method_id: cash, reversal_of: null },
    { type: "withdrawal" as const, amount: 30, payment_method_id: cash, reversal_of: null },
    { type: "supply" as const, amount: 10, payment_method_id: cash, reversal_of: null },
    { type: "sale" as const, amount: 50, payment_method_id: pix, reversal_of: "x" },
  ];

  it("estorno inverte o efeito", () => {
    expect(movementEffect(movements[1]!)).toBe(50);
    expect(movementEffect(movements[5]!)).toBe(-50);
  });

  it("esperado por forma de pagamento = mesma conta do teste SQL (160 em dinheiro, 0 no Pix)", () => {
    expect(expectedByMethod(movements, 100, cash)).toEqual({ [cash]: 160, [pix]: 0 });
  });

  it("saldo inicial entra mesmo sem movimentos em dinheiro", () => {
    expect(expectedByMethod([], 80, cash)).toEqual({ [cash]: 80 });
  });
});

describe("financeiro", () => {
  it("resultado considera só pagos e ignora transferências", () => {
    const r = periodResult([
      { kind: "income", amount: 100, status: "paid" },
      { kind: "expense", amount: 25, status: "paid" },
      { kind: "expense", amount: 999, status: "pending" },
      { kind: "transfer_out", amount: 30, status: "paid" },
    ]);
    expect(r).toEqual({ income: 100, expense: 25, result: 75 });
  });

  it("períodos", () => {
    const now = new Date(2026, 9, 24); // 24/10/2026
    expect(periodRange("this_month", now)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("last_month", now)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(periodRange("last_7_days", now)).toEqual({ from: "2026-10-18", to: "2026-10-24" });
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });
});

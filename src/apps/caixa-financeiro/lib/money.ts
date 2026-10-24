/** Cálculos e formatação do Caixa & Financeiro (puros, sem rede: testados em money.test.ts). */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return BRL.format(Number.isFinite(n) ? n : 0);
}

/**
 * Converte o que o usuário digita em reais: "1.234,56", "1234,56", "1234.56", "R$ 10".
 * Retorna null se não for um número válido. Arredonda para centavos.
 */
export function parseBRL(input: string): number | null {
  const raw = input.replace(/R\$|\s/g, "").trim();
  if (!raw) return null;
  let normalized = raw;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Soma em centavos para evitar erro de ponto flutuante. */
export function sumMoney(values: (number | string | null | undefined)[]): number {
  const cents = values.reduce<number>((acc, v) => acc + Math.round(Number(v ?? 0) * 100), 0);
  return cents / 100;
}

export type MovementLike = {
  type: "sale" | "income" | "expense" | "withdrawal" | "supply";
  amount: number | string;
  payment_method_id: string;
  reversal_of: string | null;
};

/** Efeito de um movimento no caixa: entradas positivas, saídas negativas, estorno inverte. */
export function movementEffect(m: MovementLike): number {
  const base = m.type === "sale" || m.type === "income" || m.type === "supply" ? 1 : -1;
  const sign = m.reversal_of ? -1 : 1;
  return base * sign * Number(m.amount);
}

/**
 * Valor esperado por forma de pagamento (mesma regra da função SQL close_cash_session):
 * soma dos efeitos; o saldo inicial entra na forma "dinheiro".
 */
export function expectedByMethod(
  movements: MovementLike[],
  openingAmount: number,
  cashMethodId: string | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of movements) {
    out[m.payment_method_id] = sumMoney([out[m.payment_method_id] ?? 0, movementEffect(m)]);
  }
  if (cashMethodId) out[cashMethodId] = sumMoney([out[cashMethodId] ?? 0, openingAmount]);
  return out;
}

export type PeriodKey = "this_month" | "last_month" | "last_7_days" | "today";

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  today: "Hoje",
  last_7_days: "Últimos 7 dias",
  this_month: "Este mês",
  last_month: "Mês anterior",
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Intervalo [início, fim] em datas locais (YYYY-MM-DD), inclusive. */
export function periodRange(period: PeriodKey, now: Date = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "today":
      return { from: ymd(today), to: ymd(today) };
    case "last_7_days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { from: ymd(start), to: ymd(today) };
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: ymd(start), to: ymd(end) };
    }
    case "this_month":
    default: {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: ymd(start), to: ymd(end) };
    }
  }
}

export function addDays(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return ymd(dt);
}

export function todayYmd(now: Date = new Date()): string {
  return ymd(now);
}

export type EntryLike = { kind: string; amount: number | string; status: string };

/** Resultado do período (regime de caixa): só lançamentos pagos de receita e despesa; transferências ficam de fora. */
export function periodResult(entries: EntryLike[]): { income: number; expense: number; result: number } {
  const paid = entries.filter((e) => e.status === "paid");
  const income = sumMoney(paid.filter((e) => e.kind === "income").map((e) => e.amount));
  const expense = sumMoney(paid.filter((e) => e.kind === "expense").map((e) => e.amount));
  return { income, expense, result: sumMoney([income, -expense]) };
}

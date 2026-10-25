import type { OrderStatus } from "./db";

/** Regras puras do MyFoods Compras (sem banco), cobertas por testes. */

export const STATUS_LABEL: Record<OrderStatus, string> = {
  aberto: "Rascunho",
  enviado: "Enviado",
  recebido_parcial: "Recebido em parte",
  recebido: "Recebido",
  cancelado: "Cancelado",
};
export const OPEN_STATUSES: OrderStatus[] = ["aberto", "enviado", "recebido_parcial"];

export const STATUS_TONE: Record<OrderStatus, "neutral" | "info" | "warn" | "ok" | "danger"> = {
  aberto: "neutral",
  enviado: "info",
  recebido_parcial: "warn",
  recebido: "ok",
  cancelado: "danger",
};

export type Line = { catalogItemId: string; quantity: number; unitPrice: number | null; orderItemId?: string | null };

/** Unidades contadas por peça/embalagem: a sugestão arredonda para cima. */
const WHOLE_UNITS = new Set(["un", "unidade", "cx", "pct", "dz", "fardo"]);

type StockRow = { catalog_item_id: string; quantity: number | string; minimum_stock: number | string; maximum_stock?: number | string | null; unit_of_measure: string; unit_cost?: number | string | null };

/**
 * Sugestão de pedido: produtos no mínimo ou abaixo; quantidade para chegar ao máximo
 * (ou ao dobro do mínimo, se não houver máximo).
 */
export function suggestLines(stock: StockRow[]): Line[] {
  return stock
    .filter((s) => Number(s.minimum_stock) > 0 && Number(s.quantity) <= Number(s.minimum_stock))
    .map((s) => {
      const target = s.maximum_stock != null && Number(s.maximum_stock) > 0 ? Number(s.maximum_stock) : 2 * Number(s.minimum_stock);
      const raw = Math.max(target - Number(s.quantity), 0);
      const quantity = WHOLE_UNITS.has(s.unit_of_measure) ? Math.ceil(raw) : Math.round(raw * 1000) / 1000;
      return { catalogItemId: s.catalog_item_id, quantity, unitPrice: s.unit_cost != null ? Number(s.unit_cost) : null };
    })
    .filter((l) => l.quantity > 0);
}

export const linesTotal = (lines: Pick<Line, "quantity" | "unitPrice">[]) =>
  Math.round(lines.reduce((acc, l) => acc + l.quantity * (l.unitPrice ?? 0), 0) * 100) / 100;

const fmtQty = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

/** Texto do pedido para o WhatsApp do fornecedor. */
export function orderMessage(o: {
  number: number;
  supplier: string;
  company: string;
  unit: string;
  expectedDate?: string | null;
  notes?: string | null;
  items: { name: string; unit: string; quantity: number }[];
}) {
  const lines = [
    `Olá, ${o.supplier}! Segue o pedido nº ${o.number} de ${o.company} (${o.unit}):`,
    "",
    ...o.items.map((i) => `• ${fmtQty(i.quantity)} ${i.unit} — ${i.name}`),
  ];
  if (o.expectedDate) lines.push("", `Entrega: ${o.expectedDate.split("-").reverse().join("/")}`);
  if (o.notes?.trim()) lines.push("", `Obs.: ${o.notes.trim()}`);
  lines.push("", "Pode confirmar, por favor? Obrigado!");
  return lines.join("\n");
}

/** Link do WhatsApp. Telefone brasileiro sem DDI ganha 55; sem telefone, abre para escolher o contato. */
export function whatsappLink(phone: string | null | undefined, text: string) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  const base = digits.length >= 12 ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** Variação entre as duas últimas compras de cada produto (mais recente primeiro na lista de entrada). */
export function priceChanges(rows: { catalog_item_id: string; unit_cost: number | null; received_at: string }[]) {
  const by = new Map<string, number[]>();
  for (const r of [...rows].sort((a, b) => b.received_at.localeCompare(a.received_at))) {
    if (r.unit_cost == null) continue;
    const list = by.get(r.catalog_item_id) ?? [];
    if (list.length < 2) list.push(Number(r.unit_cost));
    by.set(r.catalog_item_id, list);
  }
  return [...by.entries()]
    .filter(([, l]) => l.length === 2 && l[1]! > 0)
    .map(([id, [last, prev]]) => ({ catalogItemId: id, last: last!, previous: prev!, change: Math.round(((last! - prev!) / prev!) * 1000) / 10 }))
    .filter((c) => c.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

import { parseNumber } from "@/apps/estoque/lib/labels";

/** Linha em edição (textos como digitados; viram números ao salvar). */
export type EditLine = {
  key: string;
  catalogItemId: string;
  qtyText: string;
  priceText: string;
  orderItemId?: string | null;
  /** Quantidade pedida (no recebimento de um pedido), só para mostrar. */
  ordered?: number;
};

export const newKey = () => crypto.randomUUID();
export const toText = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export function lineValues(l: EditLine) {
  const quantity = parseNumber(l.qtyText);
  const price = l.priceText.trim() === "" ? null : parseNumber(l.priceText);
  return { quantity, price, valid: Boolean(l.catalogItemId) && Number.isFinite(quantity) && quantity > 0 && (price == null || (Number.isFinite(price) && price >= 0)) };
}

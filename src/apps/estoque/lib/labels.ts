import type { MovementType } from "@/lib/stock.shared";

/** Textos do estoque (os valores no banco continuam os mesmos). */

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  perda: "Perda",
  transferencia: "Transferência",
  inventario: "Inventário",
};

/** Efeito no saldo: entra (+), sai (−) ou define o saldo (=). */
export function movementSign(type: string): "+" | "−" | "=" {
  if (type === "entrada") return "+";
  if (type === "inventario") return "=";
  if (type === "ajuste") return "+";
  return "−";
}

/** Unidades de medida (lista fixa, sem tabela). Valores antigos fora da lista continuam aceitos. */
export const UNITS = ["un", "kg", "g", "L", "ml", "cx", "pct", "dz", "fardo"] as const;

export const ITEM_TYPE_LABEL: Record<string, string> = {
  ingrediente: "Ingrediente",
  embalagem: "Embalagem",
  limpeza: "Limpeza",
  consumo: "Consumo",
  protecao_individual: "EPI",
  uniforme: "Uniforme",
};
export const STOCK_TYPES = ["ingrediente", "embalagem", "limpeza", "consumo"] as const;
/** EPIs e uniformes são do app Documentos, mas dividem o mesmo catálogo e saldo. */
export const EPI_TYPES = ["protecao_individual", "uniforme"] as const;

export const qty = (n: number | string | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(n));

export const brl = (n: number | string | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));

export function isLow(i: { quantity: number | string; minimum_stock: number | string }) {
  const q = Number(i.quantity);
  const min = Number(i.minimum_stock);
  return q < 0 || (min > 0 && q <= min);
}

export { parseNumber } from "@/lib/parse-number";

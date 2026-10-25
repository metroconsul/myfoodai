/** Cálculos puros dos relatórios do estoque (cobertos por testes). */

type Mov = { inventory_item_id: string; movement_type: string; quantity: number | string; unit_cost?: number | string | null };
type Item = { id: string; name: string; unit_of_measure: string; unit_cost: number | string | null; last_movement_at: string | null; quantity: number | string };

/** Consumo do período por produto: saídas e perdas (transferência não é consumo). */
export function consumption(movs: Mov[], items: Item[]) {
  const byItem = new Map<string, { saida: number; perda: number }>();
  for (const m of movs) {
    if (m.movement_type !== "saida" && m.movement_type !== "perda") continue;
    const cur = byItem.get(m.inventory_item_id) ?? { saida: 0, perda: 0 };
    cur[m.movement_type] += Number(m.quantity);
    byItem.set(m.inventory_item_id, cur);
  }
  const itemMap = new Map(items.map((i) => [i.id, i]));
  return [...byItem.entries()]
    .map(([id, v]) => {
      const i = itemMap.get(id);
      const total = v.saida + v.perda;
      return {
        id,
        name: i?.name ?? "Produto",
        unit: i?.unit_of_measure ?? "",
        saida: v.saida,
        perda: v.perda,
        total,
        value: Math.round(total * Number(i?.unit_cost ?? 0) * 100) / 100,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Produtos com saldo e sem movimentação há `days` dias ou mais (ou nunca movimentados). */
export function staleItems(items: Item[], days: number, now = new Date()) {
  const limit = now.getTime() - days * 86_400_000;
  return items.filter((i) => Number(i.quantity) > 0 && (!i.last_movement_at || new Date(i.last_movement_at).getTime() < limit));
}

export function stockValue(items: Pick<Item, "quantity" | "unit_cost">[]) {
  return Math.round(items.reduce((acc, i) => acc + Math.max(0, Number(i.quantity)) * Number(i.unit_cost ?? 0), 0) * 100) / 100;
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cpdb } from "./db";

/** Consultas do MyFoods Compras. Passam pelas regras de acesso do banco (empresa, unidade, papel). */

export const comprasKey = ["compras"] as const;

/** Produtos da empresa com o saldo desta unidade (quando houver), para pedidos, recebimentos e sugestão. */
export function useProducts(unitId: string | null) {
  return useQuery({
    queryKey: [...comprasKey, "products", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const [catalog, stock] = await Promise.all([
        supabase.from("catalog_items").select("id, name, unit_of_measure, unit_cost, active, item_type").eq("active", true).order("name"),
        supabase
          .from("inventory_items")
          .select("catalog_item_id, quantity, minimum_stock, maximum_stock, unit_cost, unit_of_measure")
          .eq("unit_id", unitId!)
          .eq("active", true),
      ]);
      if (catalog.error) throw catalog.error;
      if (stock.error) throw stock.error;
      const byCatalog = new Map((stock.data ?? []).map((s) => [s.catalog_item_id, s]));
      return (catalog.data ?? []).map((c) => {
        const s = byCatalog.get(c.id);
        return {
          id: c.id,
          name: c.name,
          unit: c.unit_of_measure,
          unitCost: s?.unit_cost ?? c.unit_cost ?? null,
          quantity: s ? Number(s.quantity) : null,
          minimum: s ? Number(s.minimum_stock) : 0,
        };
      });
    },
  });
}
export type Product = NonNullable<ReturnType<typeof useProducts>["data"]>[number];

/** Linhas de saldo da unidade no formato da sugestão de pedido. */
export function useStockForSuggestion(unitId: string | null) {
  return useQuery({
    queryKey: [...comprasKey, "stock", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("catalog_item_id, quantity, minimum_stock, maximum_stock, unit_of_measure, unit_cost")
        .eq("unit_id", unitId!)
        .eq("active", true);
      if (error) throw error;
      // Todo saldo tem produto desde a migration estoque_core (os tipos gerados ainda não sabem).
      return (data ?? []).flatMap((r) => (r.catalog_item_id ? [{ ...r, catalog_item_id: r.catalog_item_id }] : []));
    },
  });
}

export function useOrders(unitId: string | null) {
  return useQuery({
    queryKey: [...comprasKey, "orders", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data, error } = await cpdb
        .from("purchase_orders")
        .select("*")
        .eq("unit_id", unitId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const orders = data ?? [];
      const ids = orders.map((o) => o.id);
      const { data: items, error: e2 } = ids.length
        ? await cpdb.from("purchase_order_items").select("*").in("order_id", ids)
        : { data: [], error: null };
      if (e2) throw e2;
      return orders.map((o) => ({ ...o, items: (items ?? []).filter((i) => i.order_id === o.id) }));
    },
  });
}
export type OrderWithItems = NonNullable<ReturnType<typeof useOrders>["data"]>[number];

export function useReceipts(unitId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: [...comprasKey, "receipts", unitId, from, to],
    enabled: Boolean(unitId) && from <= to,
    queryFn: async () => {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      const { data, error } = await cpdb
        .from("purchase_receipts")
        .select("*")
        .eq("unit_id", unitId!)
        .gte("received_at", new Date(`${from}T00:00:00`).toISOString())
        .lt("received_at", end.toISOString())
        .order("received_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const receipts = data ?? [];
      const ids = receipts.map((r) => r.id);
      const { data: items, error: e2 } = ids.length
        ? await cpdb.from("purchase_receipt_items").select("*").in("receipt_id", ids)
        : { data: [], error: null };
      if (e2) throw e2;
      return receipts.map((r) => ({ ...r, items: (items ?? []).filter((i) => i.receipt_id === r.id) }));
    },
  });
}
export type ReceiptWithItems = NonNullable<ReturnType<typeof useReceipts>["data"]>[number];

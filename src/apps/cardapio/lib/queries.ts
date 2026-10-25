import { useQuery } from "@tanstack/react-query";
import { dmdb } from "./db";

/** Consultas do app da loja (regras do banco: empresa, loja e papel). */

export const dmKey = ["cardapio"] as const;

export function useStore(unitId: string | null) {
  return useQuery({
    queryKey: [...dmKey, "store", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data, error } = await dmdb.from("dm_stores").select("*").eq("unit_id", unitId!).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useItems(unitId: string | null) {
  return useQuery({
    queryKey: [...dmKey, "items", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data, error } = await dmdb.from("dm_items").select("*").eq("unit_id", unitId!).order("category").order("sort_order").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/** Pedidos das últimas 24 horas com itens; atualiza a cada 5 segundos. */
export function useOrders(unitId: string | null) {
  return useQuery({
    queryKey: [...dmKey, "orders", unitId],
    enabled: Boolean(unitId),
    refetchInterval: 5000,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await dmdb.from("dm_orders").select("*").eq("unit_id", unitId!).gte("created_at", since).order("created_at", { ascending: true }).limit(500);
      if (error) throw new Error(error.message);
      const orders = data ?? [];
      const ids = orders.map((o) => o.id);
      const { data: items, error: e2 } = ids.length ? await dmdb.from("dm_order_items").select("*").in("order_id", ids) : { data: [], error: null };
      if (e2) throw new Error(e2.message);
      return orders.map((o) => ({ ...o, items: (items ?? []).filter((i) => i.order_id === o.id) }));
    },
  });
}
export type OrderWithItems = NonNullable<ReturnType<typeof useOrders>["data"]>[number];

/** Contas de mesa abertas, com os pedidos de cada uma. */
export function useOpenTabs(unitId: string | null) {
  return useQuery({
    queryKey: [...dmKey, "tabs", unitId],
    enabled: Boolean(unitId),
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: tabs, error } = await dmdb.from("dm_tabs").select("*").eq("unit_id", unitId!).eq("status", "aberta").order("opened_at");
      if (error) throw new Error(error.message);
      const ids = (tabs ?? []).map((t) => t.id);
      const { data: orders, error: e2 } = ids.length ? await dmdb.from("dm_orders").select("*").in("tab_id", ids) : { data: [], error: null };
      if (e2) throw new Error(e2.message);
      const oids = (orders ?? []).map((o) => o.id);
      const { data: items, error: e3 } = oids.length ? await dmdb.from("dm_order_items").select("*").in("order_id", oids) : { data: [], error: null };
      if (e3) throw new Error(e3.message);
      return (tabs ?? []).map((t) => {
        const mine = (orders ?? []).filter((o) => o.tab_id === t.id);
        return { ...t, orders: mine, items: (items ?? []).filter((i) => mine.some((o) => o.id === i.order_id && o.status !== "recusado" && o.status !== "cancelado")) };
      });
    },
  });
}

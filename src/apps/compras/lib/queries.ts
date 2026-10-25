import { useQuery } from "@tanstack/react-query";
import { ldb } from "./db";

/** Consultas das listas de compras. Passam pelas regras do banco (empresa, loja, papel). */

export const listsKey = ["compras-listas"] as const;

export function useLists(unitId: string | null) {
  return useQuery({
    queryKey: [...listsKey, "lists", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data, error } = await ldb.from("shopping_lists").select("*").eq("unit_id", unitId!).order("updated_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      const lists = data ?? [];
      const ids = lists.map((l) => l.id);
      const { data: items, error: e2 } = ids.length
        ? await ldb.from("shopping_list_items").select("list_id, name, checked").in("list_id", ids)
        : { data: [], error: null };
      if (e2) throw new Error(e2.message);
      return lists.map((l) => {
        const mine = (items ?? []).filter((i) => i.list_id === l.id);
        return { ...l, total: mine.length, missing: mine.filter((i) => !i.checked).length, preview: mine.filter((i) => !i.checked).slice(0, 4).map((i) => i.name) };
      });
    },
  });
}

export function useList(id: string) {
  return useQuery({
    queryKey: [...listsKey, "list", id],
    queryFn: async () => {
      const [list, items] = await Promise.all([
        ldb.from("shopping_lists").select("*").eq("id", id).maybeSingle(),
        ldb.from("shopping_list_items").select("*").eq("list_id", id),
      ]);
      if (list.error) throw new Error(list.error.message);
      if (items.error) throw new Error(items.error.message);
      return { list: list.data, items: items.data ?? [] };
    },
  });
}

/** Ingredientes já anotados nesta loja (sugestões ao digitar), do mais frequente para o menos. */
export function useSuggestions(unitId: string | null) {
  return useQuery({
    queryKey: [...listsKey, "suggestions", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data: lists } = await ldb.from("shopping_lists").select("id").eq("unit_id", unitId!).order("updated_at", { ascending: false }).limit(50);
      const ids = (lists ?? []).map((l) => l.id);
      if (!ids.length) return [];
      const { data } = await ldb.from("shopping_list_items").select("name").in("list_id", ids).limit(1000);
      const count = new Map<string, { name: string; n: number }>();
      for (const r of data ?? []) {
        const key = r.name.trim().toLowerCase();
        count.set(key, { name: count.get(key)?.name ?? r.name.trim(), n: (count.get(key)?.n ?? 0) + 1 });
      }
      return [...count.values()].sort((a, b) => b.n - a.n).map((x) => x.name);
    },
  });
}

export function useBuyer(unitId: string | null) {
  return useQuery({
    queryKey: [...listsKey, "buyer", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data, error } = await ldb.from("shopping_buyers").select("*").eq("unit_id", unitId!).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

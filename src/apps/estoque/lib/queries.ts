import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Consultas do MyFoods Estoque. Todas passam pelas regras de acesso do banco (empresa, unidade, papel). */

export const estoqueKey = ["estoque"] as const;

export function useStockItems(unitId: string | null) {
  return useQuery({
    queryKey: [...estoqueKey, "items", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, catalog_item_id, name, category, item_type, unit_of_measure, quantity, minimum_stock, unit_cost, active, last_movement_at")
        .eq("unit_id", unitId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
export type StockItem = NonNullable<ReturnType<typeof useStockItems>["data"]>[number];

export function useMovements(unitId: string | null, from: string, to: string, limit = 1000) {
  return useQuery({
    queryKey: [...estoqueKey, "movs", unitId, from, to, limit],
    enabled: Boolean(unitId) && from <= to,
    queryFn: async () => {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, inventory_item_id, movement_type, quantity, quantity_before, quantity_after, unit_cost, reason, occurred_at, target_unit_id, inventory_items(name, unit_of_measure)")
        .eq("unit_id", unitId!)
        .gte("occurred_at", new Date(`${from}T00:00:00`).toISOString())
        .lt("occurred_at", end.toISOString())
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}
export type Movement = NonNullable<ReturnType<typeof useMovements>["data"]>[number];

export function useAlerts(unitId: string | null) {
  return useQuery({
    queryKey: [...estoqueKey, "alerts", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_alerts")
        .select("id, alert_type, message, created_at, inventory_item_id")
        .eq("unit_id", unitId!)
        .is("resolved_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Categorias já usadas na empresa (sugestões; a categoria continua texto no produto). */
export function useCategories() {
  return useQuery({
    queryKey: [...estoqueKey, "categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalog_items").select("category").not("category", "is", null);
      if (error) throw error;
      return [...new Set((data ?? []).map((c) => (c.category ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: [...estoqueKey, "suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name, document, contact_name, phone, email, active").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

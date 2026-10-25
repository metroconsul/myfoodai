import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipos das listas de compras (migration compras_listas). Ficam aqui até a próxima regeneração de
 * src/integrations/supabase/types.ts; o cliente é o mesmo (mesma sessão e regras de acesso).
 */
type Ts = string;
export type ListStatus = "aberta" | "enviada" | "concluida";

export type ShoppingList = {
  id: string; company_id: string; unit_id: string; title: string; status: ListStatus; created_by: string | null;
  sent_at: Ts | null; done_at: Ts | null; created_at: Ts; updated_at: Ts;
};
export type ShoppingListItem = {
  id: string; list_id: string; name: string; quantity: string | null; checked: boolean; position: number;
  created_by: string | null; created_at: Ts; updated_at: Ts;
};
export type ShoppingBuyer = { unit_id: string; company_id: string; name: string; phone: string | null; updated_at: Ts };

type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type ListsDatabase = {
  public: {
    Tables: {
      shopping_lists: Table<ShoppingList>;
      shopping_list_items: Table<ShoppingListItem>;
      shopping_buyers: Table<ShoppingBuyer>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const ldb = supabase as unknown as SupabaseClient<ListsDatabase>;

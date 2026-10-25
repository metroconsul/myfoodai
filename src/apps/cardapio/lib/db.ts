import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipos do Cardápio Digital (migration cardapio_digital). Ficam aqui até a próxima regeneração de
 * src/integrations/supabase/types.ts; o cliente é o mesmo (mesma sessão; sem login = visitante).
 */
type Ts = string;
export type OrderStatus = "novo" | "aceito" | "preparando" | "pronto" | "entregue" | "recusado" | "cancelado";
export type OrderMode = "mesa" | "retirada";

export type DmStore = {
  unit_id: string; company_id: string; slug: string; display_name: string; is_open: boolean; accepts_table: boolean;
  accepts_pickup: boolean; notice: string | null; whatsapp: string | null; updated_at: Ts;
};
export type DmItem = {
  id: string; company_id: string; unit_id: string; name: string; description: string | null; category: string | null;
  price: number; photo_path: string | null; available: boolean; active: boolean; sort_order: number; created_at: Ts; updated_at: Ts;
};
export type DmTab = {
  id: string; company_id: string; unit_id: string; table_label: string; status: "aberta" | "fechada"; opened_at: Ts;
  closed_at: Ts | null; closed_by: string | null;
};
export type DmOrder = {
  id: string; company_id: string; unit_id: string; number: number; tracking_token: string; client_key: string | null;
  mode: OrderMode; table_label: string | null; tab_id: string | null; customer_name: string; customer_phone: string | null;
  notes: string | null; status: OrderStatus; total: number; paid_at: Ts | null; created_at: Ts; updated_at: Ts;
};
export type DmOrderItem = { id: string; order_id: string; item_id: string | null; name: string; unit_price: number; quantity: number; notes: string | null };

/** Respostas das funções públicas. */
export type PublicMenu = {
  store: { name: string; slug: string; is_open: boolean; accepts_table: boolean; accepts_pickup: boolean; notice: string | null; whatsapp: string | null };
  items: { id: string; name: string; description: string | null; category: string | null; price: number; photo_path: string | null; available: boolean }[];
};
export type PublicOrder = {
  number: number; status: OrderStatus; mode: OrderMode; table: string | null; total: number; created_at: Ts;
  store: { name: string; slug: string; whatsapp: string | null };
  items: { name: string; quantity: number; unit_price: number; notes: string | null }[];
};

type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type DmDatabase = {
  public: {
    Tables: {
      dm_stores: Table<DmStore>;
      dm_items: Table<DmItem>;
      dm_tabs: Table<DmTab>;
      dm_orders: Table<DmOrder>;
      dm_order_items: Table<DmOrderItem>;
    };
    Views: Record<string, never>;
    Functions: {
      dm_public_menu: { Args: { _slug: string }; Returns: PublicMenu | null };
      dm_place_order: {
        Args: {
          _slug: string; _mode: OrderMode; _table: string | null; _name: string; _phone: string | null; _notes: string | null;
          _items: { item_id: string; quantity: number }[]; _client_key: string;
        };
        Returns: { token: string; number: number };
      };
      dm_order_status: { Args: { _token: string }; Returns: PublicOrder | null };
      dm_close_tab: { Args: { _tab_id: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const dmdb = supabase as unknown as SupabaseClient<DmDatabase>;

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
/** Endereço público da foto (bucket público "menu-photos"). */
export const photoUrl = (path: string | null | undefined) => (path && SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/menu-photos/${path}` : null);

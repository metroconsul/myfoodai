import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipos das tabelas do MyFoods Compras (migration compras_core).
 * Ficam aqui até a próxima regeneração de src/integrations/supabase/types.ts; o cliente é o mesmo (mesma sessão e regras).
 */
type Ts = string;
export type OrderStatus = "aberto" | "enviado" | "recebido_parcial" | "recebido" | "cancelado";

export type PurchaseOrder = {
  id: string; company_id: string; unit_id: string; supplier_id: string; number: number; status: OrderStatus;
  expected_date: string | null; notes: string | null; created_by: string | null; sent_at: Ts | null; canceled_at: Ts | null;
  created_at: Ts; updated_at: Ts;
};
export type PurchaseOrderItem = {
  id: string; order_id: string; catalog_item_id: string; quantity: number; unit_price: number | null;
  received_quantity: number; created_at: Ts;
};
export type PurchaseReceipt = {
  id: string; company_id: string; unit_id: string; supplier_id: string | null; order_id: string | null;
  invoice_number: string | null; invoice_date: string | null; due_date: string | null; total_amount: number;
  notes: string | null; status: "confirmado" | "cancelado"; client_key: string | null; received_by: string | null;
  received_at: Ts; canceled_at: Ts | null; cancel_reason: string | null; created_at: Ts;
};
export type PurchaseReceiptItem = {
  id: string; receipt_id: string; company_id: string; catalog_item_id: string; inventory_item_id: string;
  order_item_id: string | null; quantity: number; unit_cost: number | null; created_at: Ts;
};

type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type CpDatabase = {
  public: {
    Tables: {
      purchase_orders: Table<PurchaseOrder>;
      purchase_order_items: Table<PurchaseOrderItem>;
      purchase_receipts: Table<PurchaseReceipt>;
      purchase_receipt_items: Table<PurchaseReceiptItem>;
    };
    Views: Record<string, never>;
    Functions: {
      purchase_receive: {
        Args: {
          _unit_id: string; _supplier_id: string | null; _order_id: string | null;
          _lines: { catalog_item_id: string; quantity: number; unit_cost: number | null; order_item_id: string | null }[];
          _invoice_number?: string | null; _invoice_date?: string | null; _due_date?: string | null; _notes?: string | null;
          _client_key?: string | null;
        };
        Returns: string;
      };
      purchase_cancel_receipt: { Args: { _receipt_id: string; _reason?: string | null }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Cliente Supabase do app (mesma instância, tipado com as tabelas de compras). */
export const cpdb = supabase as unknown as SupabaseClient<CpDatabase>;

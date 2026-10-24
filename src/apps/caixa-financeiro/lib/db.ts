import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipos das tabelas do Caixa & Financeiro (migrations 20261024172028 e 20261024172328).
 * Ficam aqui até a próxima regeneração de src/integrations/supabase/types.ts;
 * o cliente é o mesmo (mesma sessão, mesmo RLS).
 */
type Ts = string;
type Money = number;

export type FinAccount = {
  id: string; company_id: string; unit_id: string | null; name: string;
  kind: "cash" | "bank" | "other"; opening_balance: Money; active: boolean; created_at: Ts;
};
export type FinCategory = {
  id: string; company_id: string; kind: "income" | "expense"; name: string;
  parent_id: string | null; is_system: boolean; active: boolean;
};
export type PaymentMethod = {
  id: string; company_id: string; name: string;
  kind: "cash" | "pix" | "debit" | "credit" | "voucher" | "other";
  settlement_account_id: string | null; active: boolean;
};
export type CashRegister = {
  id: string; company_id: string; unit_id: string; name: string; account_id: string; active: boolean;
};
export type CashSession = {
  id: string; company_id: string; unit_id: string; register_id: string; status: "open" | "closed";
  opened_by: string; opened_at: Ts; opening_amount: Money; closed_by: string | null; closed_at: Ts | null;
  expected_total: Money | null; counted_total: Money | null; difference: Money | null; notes: string | null;
};
export type MovementType = "sale" | "income" | "expense" | "withdrawal" | "supply";
export type CashMovement = {
  id: string; company_id: string; unit_id: string; session_id: string; type: MovementType;
  payment_method_id: string; amount: Money; category_id: string | null; counter_account_id: string | null;
  description: string | null; reversal_of: string | null; created_by: string; created_at: Ts;
};
export type CashSessionCount = {
  id: string; session_id: string; payment_method_id: string; expected: Money; counted: Money; difference: Money;
};
export type EntryKind = "income" | "expense" | "transfer_in" | "transfer_out";
export type FinEntry = {
  id: string; company_id: string; unit_id: string | null; kind: EntryKind; category_id: string | null;
  account_id: string | null; description: string; counterparty: string | null; amount: Money;
  competence_date: string; due_date: string | null; status: "pending" | "paid" | "canceled";
  paid_at: Ts | null; payment_method_id: string | null; recurrence_id: string | null;
  source: "manual" | "cash_session" | "recurrence"; source_ref: string | null; canceled_reason: string | null;
  created_at: Ts; updated_at: Ts;
};
export type FinRecurrence = {
  id: string; company_id: string; unit_id: string | null; kind: "income" | "expense"; category_id: string | null;
  account_id: string | null; description: string; counterparty: string | null; amount: Money;
  frequency: "weekly" | "monthly" | "yearly"; starts_on: string; ends_on: string | null; active: boolean;
};
export type FinAccountBalance = {
  account_id: string; company_id: string; unit_id: string | null; name: string;
  kind: FinAccount["kind"]; active: boolean; balance: Money;
};

type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type CfDatabase = {
  public: {
    Tables: {
      fin_accounts: Table<FinAccount>;
      fin_categories: Table<FinCategory>;
      payment_methods: Table<PaymentMethod>;
      cash_registers: Table<CashRegister>;
      cash_sessions: Table<CashSession>;
      cash_movements: Table<CashMovement>;
      cash_session_counts: Table<CashSessionCount>;
      fin_entries: Table<FinEntry>;
      fin_recurrences: Table<FinRecurrence>;
    };
    Views: { fin_account_balances: { Row: FinAccountBalance; Relationships: [] } };
    Functions: {
      fin_bootstrap_company: { Args: Record<string, never>; Returns: undefined };
      close_cash_session: {
        Args: { _session_id: string; _counts: { payment_method_id: string; counted: number }[]; _notes?: string };
        Returns: undefined;
      };
      fin_materialize_recurrences: { Args: { _until: string }; Returns: number };
      cf_transfer_accounts: { Args: Record<string, never>; Returns: { id: string; name: string; kind: string }[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Cliente Supabase do app (mesma instância do projeto, tipado com as tabelas do Caixa & Financeiro). */
export const cfdb = supabase as unknown as SupabaseClient<CfDatabase>;

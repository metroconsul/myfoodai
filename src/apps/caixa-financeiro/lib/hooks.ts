import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/use-workspace";
import { cfdb } from "./db";

/** Papéis do app (a autorização real está no banco; aqui só decidimos o que mostrar). */
export function useCfRoles() {
  const { roles } = useWorkspace();
  const has = (list: string[]) => roles.some((r) => list.includes(r));
  return {
    canOperate: has(["owner", "admin", "unit_manager", "cashier"]),
    canFinance: has(["owner", "admin", "finance"]),
  };
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? ([] as unknown)) as T;
}

export const cfKeys = {
  all: ["cf"] as const,
  setup: ["cf", "setup"] as const,
  registers: ["cf", "registers"] as const,
  sessions: (status: string) => ["cf", "sessions", status] as const,
  session: (id: string) => ["cf", "session", id] as const,
  movements: (id: string) => ["cf", "movements", id] as const,
  counts: (id: string) => ["cf", "counts", id] as const,
  methods: ["cf", "methods"] as const,
  categories: ["cf", "categories"] as const,
  accounts: ["cf", "accounts"] as const,
  transferAccounts: ["cf", "transfer-accounts"] as const,
  balances: ["cf", "balances"] as const,
  entries: (filter: string) => ["cf", "entries", filter] as const,
  recurrences: ["cf", "recurrences"] as const,
};

export function usePaymentMethods() {
  return useQuery({
    queryKey: cfKeys.methods,
    queryFn: async () => unwrap(await cfdb.from("payment_methods").select("*").order("name")),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: cfKeys.categories,
    queryFn: async () => unwrap(await cfdb.from("fin_categories").select("*").order("kind").order("name")),
  });
}

export function useRegisters() {
  return useQuery({
    queryKey: cfKeys.registers,
    queryFn: async () => unwrap(await cfdb.from("cash_registers").select("*").order("name")),
  });
}

export function useTransferAccounts() {
  return useQuery({
    queryKey: cfKeys.transferAccounts,
    queryFn: async () => unwrap(await cfdb.rpc("cf_transfer_accounts")),
  });
}

export function useAccounts(enabled = true) {
  return useQuery({
    queryKey: cfKeys.accounts,
    enabled,
    queryFn: async () => unwrap(await cfdb.from("fin_accounts").select("*").order("kind").order("name")),
  });
}

export function useBalances(enabled = true) {
  return useQuery({
    queryKey: cfKeys.balances,
    enabled,
    queryFn: async () => unwrap(await cfdb.from("fin_account_balances").select("*").order("name")),
  });
}

export function useSessions(status: "open" | "closed", limit = 50) {
  return useQuery({
    queryKey: cfKeys.sessions(status),
    queryFn: async () =>
      unwrap(
        await cfdb
          .from("cash_sessions")
          .select("*")
          .eq("status", status)
          .order(status === "open" ? "opened_at" : "closed_at", { ascending: false })
          .limit(limit),
      ),
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: cfKeys.session(id),
    queryFn: async () => {
      const { data, error } = await cfdb.from("cash_sessions").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useMovements(sessionId: string) {
  return useQuery({
    queryKey: cfKeys.movements(sessionId),
    queryFn: async () =>
      unwrap(await cfdb.from("cash_movements").select("*").eq("session_id", sessionId).order("created_at")),
  });
}

export function useSessionCounts(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: cfKeys.counts(sessionId),
    enabled,
    queryFn: async () =>
      unwrap(await cfdb.from("cash_session_counts").select("*").eq("session_id", sessionId)),
  });
}

/** Saber se o app já foi configurado (há formas de pagamento e caixas visíveis). */
export function useCfSetupState() {
  const methods = usePaymentMethods();
  const registers = useRegisters();
  return {
    loading: methods.isLoading || registers.isLoading,
    configured: (methods.data?.length ?? 0) > 0 && (registers.data?.length ?? 0) > 0,
  };
}

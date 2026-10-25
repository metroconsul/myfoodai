import { supabase } from "@/integrations/supabase/client";

/** Funções de inventário do banco (migration estoque_core); ainda fora dos tipos gerados. */
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

export async function openCount(unitId: string, name?: string): Promise<string> {
  const { data, error } = await rpc("stock_open_count", { _unit_id: unitId, _name: name ?? null });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function closeCount(countId: string): Promise<number> {
  const { data, error } = await rpc("stock_close_count", { _count_id: countId });
  if (error) throw new Error(error.message);
  return Number(data);
}

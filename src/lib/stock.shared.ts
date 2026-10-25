
/**
 * Chamada única para movimentar estoque: a função do banco `stock_apply_movement`
 * (migration estoque_core) trava o saldo e grava movimento, saldo e alerta juntos.
 * Usada pelo app Estoque, pela entrega de EPIs (Documentos) e, no futuro, por Compras e Caixa.
 */
export type MovementType = "entrada" | "saida" | "ajuste" | "perda" | "transferencia" | "inventario";
export type SourceApp = "estoque" | "inventario" | "documentos" | "compras" | "caixa";

export type MovementInput = {
  itemId: string;
  type: MovementType;
  /** entrada/saída/perda/transferência > 0; ajuste = diferença com sinal; inventário = saldo contado. */
  quantity: number;
  unitCost?: number | null;
  reason?: string | null;
  reference?: string | null;
  supplierId?: string | null;
  targetUnitId?: string | null;
  sourceApp?: SourceApp;
  /** Identificador da origem (ex.: linha da nota recebida). A mesma origem não é aplicada duas vezes. */
  sourceId?: string | null;
};

export type MovementResult =
  | { ok: true; movementId: string; duplicate: boolean; before?: number; after: number }
  | { ok: false; error: string };

/** Só o que precisamos do cliente Supabase (a função ainda não está nos tipos gerados). */
type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function applyMovement(client: unknown, m: MovementInput): Promise<MovementResult> {
  const { data, error } = await (client as RpcClient).rpc("stock_apply_movement", {
    _item_id: m.itemId,
    _type: m.type,
    _quantity: m.quantity,
    _unit_cost: m.unitCost ?? null,
    _reason: m.reason ?? null,
    _reference: m.reference ?? null,
    _supplier_id: m.supplierId ?? null,
    _target_unit_id: m.targetUnitId ?? null,
    _source_app: m.sourceApp ?? "estoque",
    _source_id: m.sourceId ?? null,
  });
  if (error) return { ok: false, error: error.message || "Não foi possível registrar a movimentação." };
  const r = data as { movement_id: string; duplicate: boolean; before?: number; after: number };
  return {
    ok: true,
    movementId: r.movement_id,
    duplicate: r.duplicate,
    after: Number(r.after),
    ...(r.before != null ? { before: Number(r.before) } : {}),
  };
}

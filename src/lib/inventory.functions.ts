import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { movementSchema } from "./inventory.functions.schemas";
import { applyMovement } from "./stock.shared";

/**
 * Aplica uma movimentação de estoque pela função do banco (atômica, com histórico e alerta de mínimo).
 * Mantém a resposta antiga ({ ok, before, after } ou { error }).
 */
export const applyStockMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => movementSchema.parse(d))
  .handler(async ({ data, context }) => {
    const res = await applyMovement(context.supabase, {
      itemId: data.inventoryItemId,
      type: data.movementType,
      quantity: data.movementType === "ajuste" ? data.quantity : Math.abs(data.quantity),
      unitCost: data.unitCost ?? null,
      reason: data.reason ?? null,
      reference: data.reference ?? null,
      supplierId: data.supplierId ?? null,
      targetUnitId: data.targetUnitId ?? null,
    });
    if (!res.ok) return { error: res.error };
    return { ok: true, before: res.before ?? null, after: res.after };
  });

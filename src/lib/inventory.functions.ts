import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const movementSchema = z.object({
  inventoryItemId: z.string().uuid(),
  movementType: z.enum(["entrada", "saida", "ajuste", "perda", "transferencia", "inventario"]),
  quantity: z.number().finite(),
  unitCost: z.number().finite().nullable().optional(),
  reason: z.string().trim().max(300).nullable().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  targetUnitId: z.string().uuid().nullable().optional(),
  reference: z.string().trim().max(120).nullable().optional(),
});

/**
 * Aplica uma movimentação de estoque com trilha auditável:
 * registra quantidade anterior/posterior, atualiza o item e gera alerta de mínimo.
 */
export const applyStockMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => movementSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .select("id, company_id, unit_id, name, quantity, minimum_stock, allow_negative, unit_cost")
      .eq("id", data.inventoryItemId)
      .maybeSingle();
    if (itemError || !item) return { error: "Item não encontrado." };

    const qty = Math.abs(data.quantity);
    const before = Number(item.quantity);
    let after = before;

    switch (data.movementType) {
      case "entrada":
        after = before + qty;
        break;
      case "saida":
      case "perda":
      case "transferencia":
        after = before - qty;
        break;
      case "ajuste":
        after = before + data.quantity;
        break;
      case "inventario":
        after = qty;
        break;
    }

    if (after < 0 && !item.allow_negative) {
      return { error: "Saldo insuficiente para esta movimentação." };
    }

    const nowIso = new Date().toISOString();

    const { error: movementError } = await supabase.from("stock_movements").insert({
      company_id: item.company_id,
      unit_id: item.unit_id,
      inventory_item_id: item.id,
      movement_type: data.movementType,
      quantity: data.movementType === "ajuste" ? data.quantity : qty,
      quantity_before: before,
      quantity_after: after,
      unit_cost: data.unitCost ?? null,
      reason: data.reason ?? null,
      supplier_id: data.supplierId ?? null,
      target_unit_id: data.targetUnitId ?? null,
      reference: data.reference ?? null,
      performed_by: userId,
      occurred_at: nowIso,
    });
    if (movementError) return { error: "Não foi possível registrar a movimentação." };

    await supabase
      .from("inventory_items")
      .update({
        quantity: after,
        last_movement_at: nowIso,
        ...(data.unitCost != null ? { unit_cost: data.unitCost } : {}),
      })
      .eq("id", item.id);

    // Transferência: credita no item equivalente da unidade destino, quando existir.
    if (data.movementType === "transferencia" && data.targetUnitId) {
      const { data: target } = await supabase
        .from("inventory_items")
        .select("id, quantity")
        .eq("unit_id", data.targetUnitId)
        .eq("name", item.name)
        .maybeSingle();
      if (target) {
        const targetAfter = Number(target.quantity) + qty;
        await supabase
          .from("inventory_items")
          .update({ quantity: targetAfter, last_movement_at: nowIso })
          .eq("id", target.id);
        await supabase.from("stock_movements").insert({
          company_id: item.company_id,
          unit_id: data.targetUnitId,
          inventory_item_id: target.id,
          movement_type: "entrada",
          quantity: qty,
          quantity_before: Number(target.quantity),
          quantity_after: targetAfter,
          reason: `Transferência recebida de ${item.name}`,
          performed_by: userId,
          occurred_at: nowIso,
        });
      }
    }

    if (after <= Number(item.minimum_stock)) {
      await supabase.from("stock_alerts").insert({
        company_id: item.company_id,
        unit_id: item.unit_id,
        inventory_item_id: item.id,
        alert_type: after <= 0 ? "sem_estoque" : "abaixo_do_minimo",
        message: `${item.name} está em ${after}.`,
      });
    } else {
      await supabase
        .from("stock_alerts")
        .update({ resolved_at: nowIso })
        .eq("inventory_item_id", item.id)
        .is("resolved_at", null);
    }

    await supabase.from("audit_logs").insert({
      company_id: item.company_id,
      unit_id: item.unit_id,
      user_id: userId,
      action: "estoque_movimentado",
      entity: "inventory_items",
      entity_id: item.id,
      metadata: { movement_type: data.movementType, before, after },
    });

    return { ok: true, before, after };
  });

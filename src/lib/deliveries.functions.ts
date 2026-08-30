import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const itemSchema = z.object({
  catalogItemId: z.string().uuid(),
  quantity: z.number().positive().max(9999),
  size: z.string().trim().max(40).nullable().optional(),
  color: z.string().trim().max(40).nullable().optional(),
  lot: z.string().trim().max(60).nullable().optional(),
});

const createSchema = z.object({
  unitId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(200),
  items: z.array(itemSchema).min(1).max(30),
  reason: z.enum([
    "admissao",
    "troca",
    "reposicao",
    "perda",
    "dano",
    "mudanca_funcao",
    "retorno",
    "outro",
  ]),
  notes: z.string().trim().max(1000).nullable().optional(),
  deliveredAt: z.string().min(10).max(40),
  responsibleLabel: z.string().trim().max(160).nullable().optional(),
  allowPartial: z.boolean().default(false),
});

/**
 * Cria entregas (individual ou em lote), valida e baixa o estoque da unidade
 * e publica a pendência no Portal do Colaborador.
 */
export const createDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) return { error: "Empresa não encontrada." };
    const companyId = profile.company_id;

    const { data: employees } = await supabase
      .from("employees")
      .select("id, full_name, unit_id")
      .in("id", data.employeeIds);
    if (!employees || employees.length !== data.employeeIds.length) {
      return { error: "Alguns colaboradores não foram encontrados." };
    }

    const catalogIds = data.items.map((i) => i.catalogItemId);
    const { data: catalog } = await supabase
      .from("catalog_items")
      .select("id, name, unit_cost, active")
      .in("id", catalogIds);
    const catalogMap = new Map((catalog ?? []).map((c) => [c.id, c]));
    if (catalogMap.size !== new Set(catalogIds).size) {
      return { error: "Alguns itens não foram encontrados no catálogo." };
    }

    const { data: stockRows } = await supabase
      .from("inventory_items")
      .select("id, catalog_item_id, quantity, name, allow_negative")
      .eq("unit_id", data.unitId)
      .in("catalog_item_id", catalogIds);
    const stockMap = new Map((stockRows ?? []).map((s) => [s.catalog_item_id!, s]));

    const missingStock: string[] = [];
    const insufficient: string[] = [];
    for (const item of data.items) {
      const stock = stockMap.get(item.catalogItemId);
      const name = catalogMap.get(item.catalogItemId)?.name ?? "Item";
      if (!stock) {
        missingStock.push(name);
        continue;
      }
      const needed = item.quantity * data.employeeIds.length;
      if (Number(stock.quantity) < needed && !stock.allow_negative && !data.allowPartial) {
        insufficient.push(`${name} (disponível ${Number(stock.quantity)}, necessário ${needed})`);
      }
    }
    if (missingStock.length) {
      return {
        error: `Sem estoque cadastrado nesta unidade para: ${missingStock.join(", ")}. Cadastre o item no estoque da unidade antes de entregar.`,
      };
    }
    if (insufficient.length) {
      return { error: `Estoque insuficiente para: ${insufficient.join("; ")}.` };
    }

    const nowIso = new Date().toISOString();
    const batchId = crypto.randomUUID();
    const created: string[] = [];
    const skipped: string[] = [];

    for (const employee of employees) {
      // Reserva o estoque de cada item antes de criar a entrega do colaborador.
      const reserved: { stockId: string; before: number; after: number; item: (typeof data.items)[number] }[] = [];
      let blocked = false;

      for (const item of data.items) {
        const stock = stockMap.get(item.catalogItemId)!;
        const { data: fresh } = await supabase
          .from("inventory_items")
          .select("id, quantity, allow_negative")
          .eq("id", stock.id)
          .maybeSingle();
        const before = Number(fresh?.quantity ?? 0);
        const after = before - item.quantity;
        if (after < 0 && !fresh?.allow_negative) {
          blocked = true;
          break;
        }
        reserved.push({ stockId: stock.id, before, after, item });
      }

      if (blocked) {
        skipped.push(employee.full_name);
        continue;
      }

      const { data: delivery, error: deliveryError } = await supabase
        .from("item_deliveries")
        .insert({
          company_id: companyId,
          unit_id: data.unitId,
          employee_id: employee.id,
          responsible_user_id: userId,
          responsible_label: data.responsibleLabel ?? profile.full_name ?? null,
          batch_id: batchId,
          status: "aguardando_aceite",
          reason: data.reason,
          notes: data.notes ?? null,
          delivered_at: data.deliveredAt,
          published_at: nowIso,
        })
        .select("id")
        .maybeSingle();

      if (deliveryError || !delivery) {
        skipped.push(employee.full_name);
        continue;
      }

      const rows = data.items.map((item) => ({
        delivery_id: delivery.id,
        catalog_item_id: item.catalogItemId,
        inventory_item_id: stockMap.get(item.catalogItemId)!.id,
        item_name: catalogMap.get(item.catalogItemId)?.name ?? "Item",
        quantity: item.quantity,
        size: item.size ?? null,
        color: item.color ?? null,
        lot: item.lot ?? null,
        unit_cost_snapshot: catalogMap.get(item.catalogItemId)?.unit_cost ?? null,
      }));
      const { error: itemsError } = await supabase.from("item_delivery_items").insert(rows);
      if (itemsError) {
        // Sem itens não há entrega válida: cancela para não gerar baixa indevida.
        await supabase
          .from("item_deliveries")
          .update({ status: "cancelado", cancelled_at: nowIso, cancel_reason: "Falha ao registrar itens." })
          .eq("id", delivery.id);
        skipped.push(employee.full_name);
        continue;
      }

      for (const r of reserved) {
        await supabase
          .from("inventory_items")
          .update({ quantity: r.after, last_movement_at: nowIso })
          .eq("id", r.stockId);
        await supabase.from("stock_movements").insert({
          company_id: companyId,
          unit_id: data.unitId,
          inventory_item_id: r.stockId,
          movement_type: "saida",
          quantity: r.item.quantity,
          quantity_before: r.before,
          quantity_after: r.after,
          reason: `Entrega de item para ${employee.full_name}`,
          reference: delivery.id,
          performed_by: userId,
          occurred_at: nowIso,
        });
      }

      await supabase.from("item_delivery_events").insert([
        {
          company_id: companyId,
          delivery_id: delivery.id,
          actor_type: "gestor",
          actor_id: userId,
          actor_label: profile.full_name,
          event_type: "entrega_criada",
          metadata: { reason: data.reason, itens: rows.length },
        },
        {
          company_id: companyId,
          delivery_id: delivery.id,
          actor_type: "sistema",
          event_type: "publicada_no_portal",
          metadata: { published_at: nowIso },
        },
      ]);

      created.push(delivery.id);
    }

    return { ok: true, createdCount: created.length, deliveryIds: created, skipped };
  });

const cancelSchema = z.object({
  deliveryId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  restoreStock: z.boolean().default(true),
});

/** Cancela uma entrega mantendo a trilha de auditoria. */
export const cancelDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cancelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: delivery } = await supabase
      .from("item_deliveries")
      .select("id, company_id, unit_id, status, employee_id")
      .eq("id", data.deliveryId)
      .maybeSingle();
    if (!delivery) return { error: "Entrega não encontrada." };
    if (delivery.status === "cancelado") return { error: "Esta entrega já está cancelada." };

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("item_deliveries")
      .update({ status: "cancelado", cancelled_at: nowIso, cancel_reason: data.reason })
      .eq("id", delivery.id);
    if (error) return { error: "Não foi possível cancelar a entrega." };

    if (data.restoreStock) {
      const { data: items } = await supabase
        .from("item_delivery_items")
        .select("inventory_item_id, quantity, item_name")
        .eq("delivery_id", delivery.id);
      for (const item of items ?? []) {
        if (!item.inventory_item_id) continue;
        const { data: stock } = await supabase
          .from("inventory_items")
          .select("id, quantity")
          .eq("id", item.inventory_item_id)
          .maybeSingle();
        if (!stock) continue;
        const before = Number(stock.quantity);
        const after = before + Number(item.quantity);
        await supabase
          .from("inventory_items")
          .update({ quantity: after, last_movement_at: nowIso })
          .eq("id", stock.id);
        await supabase.from("stock_movements").insert({
          company_id: delivery.company_id,
          unit_id: delivery.unit_id,
          inventory_item_id: stock.id,
          movement_type: "entrada",
          quantity: Number(item.quantity),
          quantity_before: before,
          quantity_after: after,
          reason: "Estorno de entrega cancelada",
          reference: delivery.id,
          performed_by: userId,
          occurred_at: nowIso,
        });
      }
    }

    await supabase.from("item_delivery_events").insert({
      company_id: delivery.company_id,
      delivery_id: delivery.id,
      actor_type: "gestor",
      actor_id: userId,
      event_type: "entrega_cancelada",
      metadata: { reason: data.reason, estoque_estornado: data.restoreStock },
    });

    return { ok: true };
  });

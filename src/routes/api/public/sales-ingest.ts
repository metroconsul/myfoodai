import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  unitId: z.string().uuid(),
  metrics: z
    .array(
      z.object({
        date: z.string().min(10).max(10),
        grossAmount: z.number().finite(),
        netAmount: z.number().finite().nullable().optional(),
        ordersCount: z.number().int().nonnegative().default(0),
        cancellations: z.number().int().nonnegative().default(0),
        discounts: z.number().finite().nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

/**
 * Endpoint de ingestão de vendas (adapter webhook).
 * O chamador envia o id da conexão e o segredo configurado nela.
 */
export const Route = createFileRoute("/api/public/sales-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const connectionId = request.headers.get("x-connection-id");
        const secret = request.headers.get("x-connection-secret");
        if (!connectionId || !secret) return new Response("Credenciais ausentes", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: connection } = await supabaseAdmin
          .from("sales_connections")
          .select("id, company_id, unit_id, config, active")
          .eq("id", connectionId)
          .maybeSingle();

        const configSecret = (connection?.config as { secret?: string } | null)?.secret;
        if (!connection || !connection.active || !configSecret || configSecret !== secret) {
          return new Response("Credenciais inválidas", { status: 401 });
        }

        let parsed;
        try {
          parsed = payloadSchema.parse(await request.json());
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }

        const { data: unit } = await supabaseAdmin
          .from("units")
          .select("id")
          .eq("id", parsed.unitId)
          .eq("company_id", connection.company_id)
          .maybeSingle();
        if (!unit) return new Response("Unidade inválida", { status: 403 });

        const startedAt = new Date().toISOString();
        const rows = parsed.metrics.map((m) => ({
          company_id: connection.company_id,
          unit_id: unit.id,
          metric_date: m.date,
          gross_amount: m.grossAmount,
          net_amount: m.netAmount ?? null,
          orders_count: m.ordersCount,
          cancellations: m.cancellations,
          discounts: m.discounts ?? null,
          average_ticket: m.ordersCount > 0 ? m.grossAmount / m.ordersCount : null,
        }));

        const { error } = await supabaseAdmin
          .from("sales_daily_metrics")
          .upsert(rows, { onConflict: "unit_id,metric_date" });

        await supabaseAdmin.from("sales_import_jobs").insert({
          company_id: connection.company_id,
          connection_id: connection.id,
          unit_id: unit.id,
          period_start: rows[0]!.metric_date,
          period_end: rows[rows.length - 1]!.metric_date,
          status: error ? "erro" : "concluido",
          rows_imported: error ? 0 : rows.length,
          error: error?.message ?? null,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
        });

        await supabaseAdmin
          .from("sales_connections")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_error: error?.message ?? null,
            status: error ? "erro" : "conectado",
          })
          .eq("id", connection.id);

        if (error) return new Response("Falha ao gravar métricas", { status: 500 });
        return Response.json({ ok: true, rows: rows.length });
      },
    },
  },
});

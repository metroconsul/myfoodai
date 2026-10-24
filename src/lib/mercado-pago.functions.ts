import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MpDatabase } from "./mercado-pago.db";

/**
 * Conectar Mercado Pago (somente leitura de vendas).
 * Só dono/admin/financeiro, com o app Caixa & Financeiro ativo (função mp_manage_company no banco).
 * Os tokens ficam no servidor; o navegador só vê a situação da conexão.
 */

async function requireManager(supabase: unknown): Promise<string> {
  const { data, error } = await (supabase as SupabaseClient<MpDatabase>).rpc("mp_manage_company");
  if (error || !data) throw new Error("Só o dono, o administrador ou o financeiro podem gerenciar o Mercado Pago.");
  return data;
}

async function mpConnection(companyId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { MP_PROVIDER } = await import("./mercado-pago.shared");
  const { data } = await supabaseAdmin
    .from("sales_connections")
    .select("id, company_id, unit_id, status, active, last_sync_at, last_sync_error, config")
    .eq("company_id", companyId)
    .eq("provider", MP_PROVIDER)
    .maybeSingle();
  return data;
}

export const getMercadoPagoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await requireManager(context.supabase);
    const conn = await mpConnection(companyId);
    const configured = Boolean(process.env["MP_CLIENT_ID"] && process.env["MP_CLIENT_SECRET"]);
    if (!conn) return { configured, connected: false as const };
    return {
      configured,
      connected: conn.active && conn.status !== "nao_conectado",
      unitId: conn.unit_id,
      status: conn.status,
      lastSyncAt: conn.last_sync_at,
      lastSyncError: conn.last_sync_error,
      account: ((conn.config ?? {}) as { account?: string }).account ?? null,
    };
  });

export const startMercadoPagoConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unitId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await requireManager(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mpAdmin, mpClientId, mpRedirectUri } = await import("./mercado-pago.server");
    const { MP_PROVIDER, buildAuthorizeUrl, pkceChallenge, randomToken } = await import("./mercado-pago.shared");

    const { data: unit } = await supabaseAdmin
      .from("units")
      .select("id")
      .eq("id", data.unitId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!unit) throw new Error("Unidade inválida.");

    // Limpa estados vencidos e cria um novo, de uso único.
    await mpAdmin.from("provider_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const state = randomToken();
    const verifier = randomToken(48);
    const { error } = await mpAdmin.from("provider_oauth_states").insert({
      state,
      company_id: companyId,
      unit_id: unit.id,
      user_id: context.userId,
      provider: MP_PROVIDER,
      code_verifier: verifier,
    });
    if (error) throw new Error("Não foi possível iniciar a conexão.");

    return {
      url: buildAuthorizeUrl({
        clientId: mpClientId(),
        redirectUri: mpRedirectUri(),
        state,
        challenge: await pkceChallenge(verifier),
      }),
    };
  });

export const syncMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await requireManager(context.supabase);
    const conn = await mpConnection(companyId);
    if (!conn || !conn.active) throw new Error("Mercado Pago não está conectado.");
    const { syncConnection } = await import("./mercado-pago.server");
    return syncConnection(conn);
  });

export const disconnectMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await requireManager(context.supabase);
    const conn = await mpConnection(companyId);
    if (!conn) return { ok: true };
    const { disconnect } = await import("./mercado-pago.server");
    await disconnect(conn.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      company_id: companyId,
      user_id: context.userId,
      action: "mercado_pago_desconectado",
      entity: "sales_connections",
      metadata: { connection_id: conn.id },
    });
    return { ok: true };
  });

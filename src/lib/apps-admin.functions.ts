import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ativação de aplicativos por empresa (fundação F1).
 * Só a administração da plataforma executa. Grava em feature_entitlements com source 'app_contract'
 * (que a troca de plano não desliga) e registra em audit_logs. Não envolve Stripe.
 */

export const APP_CODES = [
  "app_ponto",
  "app_documentos",
  "app_estoque",
  "app_compras",
  "app_caixa_financeiro",
  "app_cardapio",
] as const;

const setCompanyAppSchema = z.object({
  companyId: z.string().uuid(),
  app: z.enum(APP_CODES),
  enabled: z.boolean(),
});

export const listCompanyApps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requirePlatformAdmin } = await import("./plan.server");
    await requirePlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: companies, error: cErr }, { data: ents, error: eErr }] = await Promise.all([
      supabaseAdmin
        .from("companies")
        .select("id, name, plan_code, subscription_status, access_source")
        .order("name"),
      supabaseAdmin
        .from("feature_entitlements")
        .select("company_id, feature_code, enabled")
        .in("feature_code", [...APP_CODES]),
    ]);
    if (cErr || eErr) throw new Error("Não foi possível carregar as empresas.");

    return {
      companies: (companies ?? []).map((c) => ({
        ...c,
        apps: Object.fromEntries(
          APP_CODES.map((code) => [
            code,
            Boolean(ents?.find((e) => e.company_id === c.id && e.feature_code === code)?.enabled),
          ]),
        ) as Record<(typeof APP_CODES)[number], boolean>,
      })),
    };
  });

export const setCompanyApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setCompanyAppSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { requirePlatformAdmin } = await import("./plan.server");
    await requirePlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("feature_entitlements").upsert(
      {
        company_id: data.companyId,
        feature_code: data.app,
        enabled: data.enabled,
        source: "app_contract",
      },
      { onConflict: "company_id,feature_code" },
    );
    if (error) throw new Error("Não foi possível atualizar o aplicativo.");

    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: data.enabled ? "app_ativado" : "app_desativado",
      entity: "feature_entitlements",
      metadata: { app: data.app },
    });
    return { ok: true };
  });

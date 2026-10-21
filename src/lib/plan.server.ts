/** Autorização por plano no servidor (server-only). */

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function companyOfUser(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.company_id ?? null;
}

export async function hasCompanyAccess(companyId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("companies")
    .select("access_source, subscription_status, trial_ends_at")
    .eq("id", companyId)
    .maybeSingle();
  if (!data) return false;
  if (data.access_source === "admin_grant" && data.subscription_status === "admin_grant") return true;
  if (data.access_source === "subscription") return ["active", "trialing"].includes(data.subscription_status);
  return data.access_source === "trial" && data.subscription_status === "trialing" && Boolean(data.trial_ends_at && new Date(data.trial_ends_at) > new Date());
}

/**
 * Garante que a empresa do usuário tem o recurso liberado.
 * A conta dona do produto (platform admin) nunca é bloqueada.
 */
export async function requireFeature(userId: string, featureCode: string): Promise<string> {
  if (await isPlatformAdmin(userId)) {
    const companyId = await companyOfUser(userId);
    if (!companyId) throw new Error("Empresa não encontrada.");
    return companyId;
  }

  const companyId = await companyOfUser(userId);
  if (!companyId) throw new Error("Empresa não encontrada.");
  if (!(await hasCompanyAccess(companyId))) throw new Error("Assinatura inválida ou indisponível.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("feature_entitlements")
    .select("enabled")
    .eq("company_id", companyId)
    .eq("feature_code", featureCode)
    .maybeSingle();

  if (!data?.enabled) {
    throw new Error("Recurso não incluído no plano contratado.");
  }
  return companyId;
}

export async function requirePlatformAdmin(userId: string): Promise<void> {
  if (!(await isPlatformAdmin(userId))) {
    throw new Error("Acesso restrito à administração da plataforma.");
  }
}

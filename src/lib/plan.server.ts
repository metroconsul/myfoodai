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

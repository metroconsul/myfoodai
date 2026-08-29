/** Resolução de sessão do Portal do Colaborador (server-only). */

export async function resolveSession(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { hashToken } = await import("./portal.server");
  const { data: session } = await supabaseAdmin
    .from("portal_sessions")
    .select("id, employee_id, expires_at, revoked_at")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) return null;
  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select(
      "id, full_name, company_id, unit_id, avatar_url, employee_code, employment_status, role_id, team_id",
    )
    .eq("id", session.employee_id)
    .maybeSingle();
  return employee ?? null;
}

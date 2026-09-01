import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { acceptanceSchema, privacySchema, tokenSchema } from "./policies.functions.schemas";

async function isCompanyAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  return (data ?? []).some((r: { role: string }) => r.role === "owner" || r.role === "admin");
}

async function requireAdminCompany(context: { supabase: any; userId: string }) {
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("company_id")
    .eq("id", context.userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Empresa não encontrada.");
  const isAdmin = await isCompanyAdmin(context);
  if (!isAdmin) throw new Error("Apenas administradores podem alterar estas políticas.");
  return profile.company_id as string;
}

/** Lê as políticas da empresa do usuário logado (com valores padrão aplicados). */
export const getCompanyPolicies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    const { getAcceptancePolicy, getPrivacyPolicy } = await import("./policies.server");
    const companyId = profile?.company_id ?? null;
    const isAdmin = await isCompanyAdmin(context);
    const [acceptance, privacy] = await Promise.all([
      getAcceptancePolicy(companyId),
      getPrivacyPolicy(companyId),
    ]);
    return { acceptance, privacy, isAdmin: Boolean(isAdmin) };
  });

export const saveAcceptancePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => acceptanceSchema.parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await requireAdminCompany(context as never);
    const { error } = await context.supabase.from("acceptance_policies").upsert(
      {
        company_id: companyId,
        deadline_days: data.deadlineDays,
        signature_method: data.signatureMethod,
        require_face: data.requireFace,
        require_location: data.requireLocation,
        allow_typed_signature: data.allowTypedSignature,
        geofence_enabled: data.geofenceEnabled,
        geofence_radius_meters: data.geofenceRadiusMeters,
        geofence_block_outside: data.geofenceBlockOutside,
        face_provider: data.faceProvider,
        face_provider_endpoint: data.faceProviderEndpoint || null,
        geocoding_provider: data.geocodingProvider,
        geocoding_endpoint: data.geocodingEndpoint || null,
        updated_by: context.userId,
      },
      { onConflict: "company_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const savePrivacyPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => privacySchema.parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await requireAdminCompany(context as never);
    const { error } = await context.supabase.from("privacy_policies").upsert(
      {
        company_id: companyId,
        controller_name: data.controllerName || null,
        dpo_name: data.dpoName || null,
        dpo_email: data.dpoEmail || null,
        purposes: data.purposes,
        legal_bases: data.legalBases,
        retention_months: data.retentionMonths,
        retention_notes: data.retentionNotes || null,
        privacy_url: data.privacyUrl || null,
        consent_version: data.consentVersion,
        data_text: data.dataText || null,
        biometrics_text: data.biometricsText || null,
        location_text: data.locationText || null,
        notice_text: data.noticeText || null,
        updated_by: context.userId,
      },
      { onConflict: "company_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Políticas aplicáveis ao colaborador logado no Portal (aceite + textos LGPD). */
export const portalPolicies = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { getAcceptancePolicy, getPrivacyPolicy } = await import("./policies.server");
    const [acceptance, privacy] = await Promise.all([
      getAcceptancePolicy(employee.company_id),
      getPrivacyPolicy(employee.company_id),
    ]);
    return { acceptance, privacy };
  });

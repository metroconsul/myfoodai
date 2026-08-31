/** Leitura das políticas por empresa (server-only). */
import {
  DEFAULT_ACCEPTANCE_POLICY,
  DEFAULT_PRIVACY_POLICY,
  type AcceptancePolicy,
  type PrivacyPolicy,
} from "./policies.shared";

export async function getAcceptancePolicy(companyId: string | null | undefined): Promise<AcceptancePolicy> {
  if (!companyId) return DEFAULT_ACCEPTANCE_POLICY;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("acceptance_policies")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!data) return DEFAULT_ACCEPTANCE_POLICY;
    return {
      deadlineDays: data.deadline_days ?? DEFAULT_ACCEPTANCE_POLICY.deadlineDays,
      signatureMethod: (data.signature_method ?? DEFAULT_ACCEPTANCE_POLICY.signatureMethod) as AcceptancePolicy["signatureMethod"],
      requireFace: data.require_face ?? DEFAULT_ACCEPTANCE_POLICY.requireFace,
      requireLocation: data.require_location ?? DEFAULT_ACCEPTANCE_POLICY.requireLocation,
      allowTypedSignature: data.allow_typed_signature ?? DEFAULT_ACCEPTANCE_POLICY.allowTypedSignature,
      geofenceEnabled: data.geofence_enabled ?? false,
      geofenceRadiusMeters: data.geofence_radius_meters ?? DEFAULT_ACCEPTANCE_POLICY.geofenceRadiusMeters,
      geofenceBlockOutside: data.geofence_block_outside ?? false,
      faceProvider: (data.face_provider ?? DEFAULT_ACCEPTANCE_POLICY.faceProvider) as AcceptancePolicy["faceProvider"],
      faceProviderEndpoint: data.face_provider_endpoint ?? null,
      geocodingProvider: (data.geocoding_provider ?? DEFAULT_ACCEPTANCE_POLICY.geocodingProvider) as AcceptancePolicy["geocodingProvider"],
      geocodingEndpoint: data.geocoding_endpoint ?? null,
    };
  } catch {
    return DEFAULT_ACCEPTANCE_POLICY;
  }
}

export async function getPrivacyPolicy(companyId: string | null | undefined): Promise<PrivacyPolicy> {
  if (!companyId) return DEFAULT_PRIVACY_POLICY;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("privacy_policies")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!data) return DEFAULT_PRIVACY_POLICY;
    const list = (value: unknown, fallback: string[]) =>
      Array.isArray(value) && value.length ? (value as string[]) : fallback;
    return {
      controllerName: data.controller_name ?? null,
      dpoName: data.dpo_name ?? null,
      dpoEmail: data.dpo_email ?? null,
      purposes: list(data.purposes, DEFAULT_PRIVACY_POLICY.purposes),
      legalBases: list(data.legal_bases, DEFAULT_PRIVACY_POLICY.legalBases),
      retentionMonths: data.retention_months ?? DEFAULT_PRIVACY_POLICY.retentionMonths,
      retentionNotes: data.retention_notes ?? null,
      privacyUrl: data.privacy_url ?? null,
      consentVersion: data.consent_version ?? DEFAULT_PRIVACY_POLICY.consentVersion,
      dataText: data.data_text ?? null,
      biometricsText: data.biometrics_text ?? null,
      locationText: data.location_text ?? null,
      noticeText: data.notice_text ?? null,
    };
  } catch {
    return DEFAULT_PRIVACY_POLICY;
  }
}

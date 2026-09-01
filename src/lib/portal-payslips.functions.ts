import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(10).max(200) });
const payslipSchema = tokenSchema.extend({ payslipId: z.string().uuid() });

const geoSchema = {
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  locationStatus: z.enum(["obtida", "negada", "imprecisa", "indisponivel", "nao_disponivel"]),
};

const consentSchema = {
  consentData: z.boolean().default(false),
  consentBiometrics: z.boolean().default(false),
  consentLocation: z.boolean().default(false),
};

async function requestMeta() {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start-server");
    const ip =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      getRequestHeader("cf-connecting-ip") ??
      null;
    return { ip, userAgent: getRequestHeader("user-agent") ?? null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Lista os holerites disponíveis para o colaborador logado no portal. */
export const portalMyPayslips = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("payslips")
      .select(
        "id, payroll_period, reference_label, status, current_version, acceptance_policy, due_at, published_at, viewed_at, signed_at",
      )
      .eq("employee_id", employee.id)
      .not("status", "in", "(draft,validating,validation_error,cancelled,archived)")
      .order("payroll_period", { ascending: false });

    return { payslips: rows ?? [] };
  });

/** Abre o documento: registra visualização e devolve URL assinada de curta duração. */
export const portalPayslipDetail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => payslipSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit, hashOrNull } = await import("./payslips.server");
    const meta = await requestMeta();

    const { data: payslip } = await supabaseAdmin
      .from("payslips")
      .select("*")
      .eq("id", data.payslipId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!payslip || ["draft", "validating", "validation_error", "cancelled"].includes(payslip.status)) {
      return { error: "Documento indisponível." as const };
    }

    const [{ data: version }, { data: signature }, { data: disputes }] = await Promise.all([
      supabaseAdmin
        .from("payslip_versions")
        .select("version, storage_object_key, file_sha256, mime_type, file_size_bytes, original_file_name, correction_reason, uploaded_at")
        .eq("payslip_id", payslip.id)
        .eq("version", payslip.current_version)
        .maybeSingle(),
      supabaseAdmin
        .from("payslip_signatures")
        .select("*")
        .eq("payslip_id", payslip.id)
        .eq("version", payslip.current_version)
        .maybeSingle(),
      supabaseAdmin
        .from("payslip_disputes")
        .select("id, category, description, status, hr_response, created_at, resolved_at, version")
        .eq("payslip_id", payslip.id)
        .order("created_at", { ascending: false }),
    ]);

    let url: string | null = null;
    if (version) {
      const { data: signed } = await supabaseAdmin.storage
        .from("payslips")
        .createSignedUrl(version.storage_object_key, 300);
      url = signed?.signedUrl ?? null;
    }

    const ipHash = await hashOrNull(meta.ip);
    if (!payslip.viewed_at) {
      await supabaseAdmin
        .from("payslips")
        .update({
          viewed_at: new Date().toISOString(),
          status: payslip.status === "published" ? "viewed" : payslip.status,
        })
        .eq("id", payslip.id);
    }
    await recordAudit(supabaseAdmin, {
      companyId: payslip.company_id,
      unitId: payslip.unit_id,
      actorType: "colaborador",
      actorId: employee.id,
      subjectId: payslip.id,
      subjectVersion: payslip.current_version,
      eventType: "payslip.viewed",
      ipHash,
      userAgentHash: await hashOrNull(meta.userAgent),
      metadata: { fileSha256: version?.file_sha256 ?? null },
    });

    return {
      payslip,
      version: version
        ? {
            version: version.version,
            fileSha256: version.file_sha256,
            mimeType: version.mime_type,
            sizeBytes: version.file_size_bytes,
            fileName: version.original_file_name,
            correctionReason: version.correction_reason,
            uploadedAt: version.uploaded_at,
          }
        : null,
      url,
      signature: signature ?? null,
      disputes: disputes ?? [],
    };
  });

/** Validação facial com provedor real antes da assinatura. */
export const portalPayslipFaceCheck = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    payslipSchema
      .extend({
        imageDataUrl: z.string().min(64).max(4_000_000),
        ...consentSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    if (!data.consentData || !data.consentBiometrics) {
      return { error: "É necessário autorizar a validação de identidade para continuar." as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { validateFace } = await import("./face-validation.server");
    const { recordAudit, hashOrNull } = await import("./payslips.server");
    const meta = await requestMeta();

    const { data: payslip } = await supabaseAdmin
      .from("payslips")
      .select("id, company_id, unit_id, current_version, status")
      .eq("id", data.payslipId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!payslip) return { error: "Documento indisponível." as const };

    const base = {
      companyId: payslip.company_id,
      unitId: payslip.unit_id,
      actorType: "colaborador" as const,
      actorId: employee.id,
      subjectId: payslip.id,
      subjectVersion: payslip.current_version,
      ipHash: await hashOrNull(meta.ip),
    };
    await recordAudit(supabaseAdmin, { ...base, eventType: "payslip.face_validation_started", metadata: {} });

    const { result } = await validateFace({
      imageDataUrl: data.imageDataUrl,
      employeeId: employee.id,
      deliveryId: payslip.id,
      companyId: payslip.company_id,
    });

    const mapped =
      result.status === "aprovado" ? "approved" : result.status === "reprovado" ? "rejected" : "provider_unavailable";

    await recordAudit(supabaseAdmin, {
      ...base,
      eventType: mapped === "approved" ? "payslip.face_validation_completed" : "payslip.face_validation_failed",
      eventResult: mapped === "approved" ? "success" : "failure",
      // A imagem da selfie nunca é armazenada: guardamos apenas o resultado.
      metadata: { provider: result.provider, liveness: result.liveness, reference: result.reference },
    });

    if (mapped === "approved" && payslip.status !== "signed") {
      await supabaseAdmin.from("payslips").update({ status: "awaiting_signature" }).eq("id", payslip.id);
    }

    return {
      status: mapped,
      liveness: result.liveness,
      provider: result.provider,
      reference: result.reference,
      message: result.message ?? null,
    };
  });

/** Registra a assinatura eletrônica com evidências auditáveis. */
export const portalSignPayslip = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    payslipSchema
      .extend({
        mode: z.enum(["ciencia", "assinatura"]),
        signatureDataUrl: z.string().max(4_000_000).nullable().optional(),
        typedName: z.string().trim().max(160).nullable().optional(),
        faceStatus: z
          .enum(["not_required", "approved", "rejected", "provider_unavailable", "not_started"])
          .default("not_required"),
        faceProviderRef: z.string().max(200).nullable().optional(),
        faceLiveness: z.string().max(40).nullable().optional(),
        deviceInfo: z.string().max(400).nullable().optional(),
        ...geoSchema,
        ...consentSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    if (!data.consentData) {
      return { error: "Autorize o tratamento dos dados (LGPD) para assinar." as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit, hashOrNull, sha256Hex } = await import("./payslips.server");
    const { decodeImageDataUrl, maskIp } = await import("./face-validation.server");
    const { resolveGeoAudit } = await import("./geo-validation.server");
    const shared = await import("./payslips.shared");
    const meta = await requestMeta();

    const { data: payslip } = await supabaseAdmin
      .from("payslips")
      .select("id, company_id, unit_id, current_version, status, acceptance_policy")
      .eq("id", data.payslipId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!payslip) return { error: "Documento indisponível." as const };
    if (payslip.status === "signed") return { error: "Este documento já foi assinado." as const };
    if (["draft", "validating", "validation_error", "cancelled"].includes(payslip.status)) {
      return { error: "Documento indisponível para aceite." as const };
    }

    const needsSignature = shared.requiresSignature(payslip.acceptance_policy);
    if (needsSignature && !data.signatureDataUrl && (data.typedName ?? "").trim().length < 3) {
      return { error: "Assine no campo indicado ou digite seu nome completo." as const };
    }
    if (shared.requiresFace(payslip.acceptance_policy) && data.faceStatus !== "approved") {
      return { error: "Conclua a validação de identidade antes de assinar." as const };
    }

    const { data: version } = await supabaseAdmin
      .from("payslip_versions")
      .select("file_sha256")
      .eq("payslip_id", payslip.id)
      .eq("version", payslip.current_version)
      .maybeSingle();

    const { data: unit } = payslip.unit_id
      ? await supabaseAdmin
          .from("units")
          .select("latitude, longitude, point_radius_meters")
          .eq("id", payslip.unit_id)
          .maybeSingle()
      : { data: null };

    const geoAudit = data.consentLocation
      ? await resolveGeoAudit({ latitude: data.latitude ?? null, longitude: data.longitude ?? null, unit, companyId: payslip.company_id })
      : null;

    let signatureKey: string | null = null;
    if (data.signatureDataUrl) {
      const bytes = decodeImageDataUrl(data.signatureDataUrl);
      if (bytes) {
        const key = `${payslip.company_id}/${payslip.id}/assinatura-v${payslip.current_version}.png`;
        const { error } = await supabaseAdmin.storage
          .from("signatures")
          .upload(key, bytes, { contentType: "image/png", upsert: true });
        if (!error) signatureKey = key;
      }
    }

    const signedAt = new Date().toISOString();
    const consent = {
      version: (await import("./lgpd.shared")).LGPD_CONSENT_VERSION,
      data: data.consentData,
      biometrics: data.consentBiometrics,
      location: data.consentLocation,
      acceptedAt: signedAt,
    };

    const integrityHash = await sha256Hex(
      JSON.stringify({
        payslipId: payslip.id,
        version: payslip.current_version,
        employeeId: employee.id,
        fileSha256: version?.file_sha256 ?? null,
        signedAt,
        termVersion: shared.PAYSLIP_TERM_VERSION,
        consent,
      }),
    );

    const ipHash = await hashOrNull(meta.ip);
    const { error: signError } = await supabaseAdmin.from("payslip_signatures").insert({
      payslip_id: payslip.id,
      company_id: payslip.company_id,
      version: payslip.current_version,
      employee_id: employee.id,
      signature_method: needsSignature ? (data.signatureDataUrl ? "desenhada" : "digitada") : "ciencia",
      provider_name: "my-foods-ai",
      signature_reference: data.typedName?.trim() || employee.full_name,
      signature_object_key: signatureKey,
      term_version: shared.PAYSLIP_TERM_VERSION,
      term_text: shared.PAYSLIP_TERM_TEXT,
      signed_at: signedAt,
      integrity_hash: integrityHash,
      file_sha256: version?.file_sha256 ?? null,
      face_status: data.faceStatus,
      liveness_status: data.faceLiveness ?? null,
      face_provider_ref: data.faceProviderRef ?? null,
      location_status: data.consentLocation ? data.locationStatus : "negada",
      latitude: data.consentLocation ? (data.latitude ?? null) : null,
      longitude: data.consentLocation ? (data.longitude ?? null) : null,
      accuracy_meters: data.consentLocation ? (data.accuracy ?? null) : null,
      location_captured_at: data.consentLocation && data.latitude != null ? signedAt : null,
      geo_address: geoAudit?.address ?? null,
      geo_distance_meters: geoAudit?.distanceMeters ?? null,
      ip_hash: ipHash,
      ip_masked: maskIp(meta.ip),
      device_metadata: { userAgent: data.deviceInfo ?? null, geo: geoAudit },
      consent,
    });
    if (signError) return { error: "Não foi possível registrar a assinatura." as const };

    await supabaseAdmin.from("payslips").update({ status: "signed", signed_at: signedAt }).eq("id", payslip.id);

    await recordAudit(supabaseAdmin, {
      companyId: payslip.company_id,
      unitId: payslip.unit_id,
      actorType: "colaborador",
      actorId: employee.id,
      subjectId: payslip.id,
      subjectVersion: payslip.current_version,
      eventType: "payslip.signature_completed",
      ipHash,
      userAgentHash: await hashOrNull(meta.userAgent),
      metadata: {
        integrityHash,
        faceStatus: data.faceStatus,
        locationStatus: data.consentLocation ? data.locationStatus : "negada",
        consentVersion: consent.version,
      },
    });

    return { ok: true as const, integrityHash, signedAt };
  });

/** Abre uma divergência sobre o documento. */
export const portalOpenPayslipDispute = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    payslipSchema
      .extend({
        category: z.enum(["identificacao", "competencia", "valor", "desconto", "ausencia_informacao", "outro"]),
        description: z.string().trim().min(10).max(1200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit } = await import("./payslips.server");

    const { data: payslip } = await supabaseAdmin
      .from("payslips")
      .select("id, company_id, unit_id, current_version, status")
      .eq("id", data.payslipId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!payslip) return { error: "Documento indisponível." as const };

    const { data: dispute, error } = await supabaseAdmin
      .from("payslip_disputes")
      .insert({
        payslip_id: payslip.id,
        company_id: payslip.company_id,
        version: payslip.current_version,
        employee_id: employee.id,
        category: data.category,
        description: data.description,
        status: "aberta",
      })
      .select("id")
      .single();
    if (error || !dispute) return { error: "Não foi possível registrar a divergência." as const };

    if (payslip.status !== "signed") {
      await supabaseAdmin.from("payslips").update({ status: "dispute_open" }).eq("id", payslip.id);
    }

    await recordAudit(supabaseAdmin, {
      companyId: payslip.company_id,
      unitId: payslip.unit_id,
      actorType: "colaborador",
      actorId: employee.id,
      subjectId: payslip.id,
      subjectVersion: payslip.current_version,
      eventType: "payslip.dispute_created",
      metadata: { disputeId: dispute.id, category: data.category },
    });

    return { ok: true as const, disputeId: dispute.id };
  });

/** Comprovante de aceite com evidências e cadeia de auditoria resumida. */
export const portalPayslipReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => payslipSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payslip } = await supabaseAdmin
      .from("payslips")
      .select("id, payroll_period, reference_label, current_version, signed_at, status, acceptance_policy")
      .eq("id", data.payslipId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!payslip) return { error: "Documento indisponível." as const };

    const [{ data: signature }, { data: events }] = await Promise.all([
      supabaseAdmin
        .from("payslip_signatures")
        .select("*")
        .eq("payslip_id", payslip.id)
        .eq("version", payslip.current_version)
        .maybeSingle(),
      supabaseAdmin
        .from("payslip_audit_events")
        .select("event_type, event_result, occurred_at, event_hash, previous_event_hash, subject_version")
        .eq("subject_id", payslip.id)
        .order("occurred_at", { ascending: true }),
    ]);

    return {
      payslip,
      employeeName: employee.full_name,
      signature: signature ?? null,
      events: events ?? [],
    };
  });

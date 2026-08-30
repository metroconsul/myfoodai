import { createServerFn, getRequestHeader } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(10).max(200) });
const deliverySchema = tokenSchema.extend({ deliveryId: z.string().uuid() });

const geoSchema = {
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  locationStatus: z.enum(["obtida", "negada", "imprecisa", "indisponivel", "nao_disponivel"]),
};

/** Consentimento explícito (LGPD) para biometria e localização. */
const consentSchema = {
  consentBiometrics: z.boolean(),
  consentLocation: z.boolean(),
};

const validateSchema = deliverySchema.extend({
  imageDataUrl: z.string().min(64).max(4_000_000),
  ...geoSchema,
  ...consentSchema,
  deviceInfo: z.string().max(400).nullable().optional(),
});

const acceptSchema = deliverySchema.extend({
  signatureType: z.enum(["desenhada", "digitada"]),
  signatureDataUrl: z.string().max(4_000_000).nullable().optional(),
  typedName: z.string().trim().max(160).nullable().optional(),
  ...geoSchema,
  ...consentSchema,
  deviceInfo: z.string().max(400).nullable().optional(),
  faceSkipReason: z.string().trim().max(300).nullable().optional(),
});

/** IP do cliente mascarado para a trilha de auditoria. */
function clientIp() {
  const forwarded = getRequestHeader("x-forwarded-for") ?? getRequestHeader("cf-connecting-ip");
  return forwarded?.split(",")[0]?.trim() ?? null;
}


const refuseSchema = deliverySchema.extend({
  mode: z.enum(["recusado", "divergente"]),
  reason: z.string().trim().min(3).max(600),
});

const SELECT_DELIVERY =
  "id, company_id, unit_id, employee_id, status, reason, notes, delivered_at, published_at, accepted_at, refused_at, refusal_reason, divergence_notes, responsible_label, item_delivery_items(id, item_name, quantity, size, color, lot)";

/** Lista as entregas de itens do colaborador logado no portal. */
export const portalMyItems = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: deliveries } = await supabaseAdmin
      .from("item_deliveries")
      .select(SELECT_DELIVERY)
      .eq("employee_id", employee.id)
      .neq("status", "rascunho")
      .order("delivered_at", { ascending: false })
      .limit(60);

    const rows = deliveries ?? [];
    return {
      deliveries: rows,
      pendingCount: rows.filter((d) => d.status === "aguardando_aceite" || d.status === "em_validacao")
        .length,
    };
  });

/** Detalhe de uma entrega + evidências já registradas. */
export const portalItemDelivery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => deliverySchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: delivery } = await supabaseAdmin
      .from("item_deliveries")
      .select(SELECT_DELIVERY)
      .eq("id", data.deliveryId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!delivery) return { error: "Entrega não encontrada." as const };

    const [{ data: evidence }, { data: unit }] = await Promise.all([
      supabaseAdmin
        .from("item_delivery_evidence")
        .select("face_status, liveness_status, location_status, signature_type, integrity_hash, created_at")
        .eq("delivery_id", delivery.id)
        .maybeSingle(),
      supabaseAdmin.from("units").select("name").eq("id", delivery.unit_id).maybeSingle(),
    ]);

    await supabaseAdmin.from("item_delivery_events").insert({
      company_id: delivery.company_id,
      delivery_id: delivery.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      actor_label: employee.full_name,
      event_type: "entrega_visualizada",
      metadata: {},
    });

    return { delivery, evidence: evidence ?? null, unitName: unit?.name ?? null };
  });

async function upsertEvidence(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  deliveryId: string,
  patch: Record<string, unknown>,
) {
  const { data: existing } = await supabaseAdmin
    .from("item_delivery_evidence")
    .select("id")
    .eq("delivery_id", deliveryId)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin
      .from("item_delivery_evidence")
      .update(patch as never)
      .eq("id", existing.id);
  } else {
    await supabaseAdmin
      .from("item_delivery_evidence")
      .insert({ delivery_id: deliveryId, ...patch } as never);
  }
}

/** Valida a identidade do colaborador (selfie) antes da assinatura. */
export const portalValidateIdentity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => validateSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { validateFace } = await import("./face-validation.server");

    const { data: delivery } = await supabaseAdmin
      .from("item_deliveries")
      .select("id, company_id, status")
      .eq("id", data.deliveryId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!delivery) return { error: "Entrega não encontrada." as const };
    if (delivery.status !== "aguardando_aceite" && delivery.status !== "em_validacao") {
      return { error: "Esta entrega não está disponível para aceite." as const };
    }

    const { result, bytes } = await validateFace({
      imageDataUrl: data.imageDataUrl,
      employeeId: employee.id,
      deliveryId: delivery.id,
    });

    let assetPath: string | null = null;
    if (bytes) {
      const path = `${delivery.company_id}/entregas/${delivery.id}/selfie.jpg`;
      const { error } = await supabaseAdmin.storage
        .from("signatures")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (!error) assetPath = path;
    }

    await upsertEvidence(supabaseAdmin, delivery.id, {
      face_status: result.status,
      face_provider: result.provider,
      face_provider_reference: result.reference,
      face_asset_path: assetPath,
      liveness_status: result.liveness,
      face_validated_at: new Date().toISOString(),
      location_status: data.locationStatus,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      accuracy_meters: data.accuracy ?? null,
      location_captured_at: data.latitude != null ? new Date().toISOString() : null,
      device_metadata: { userAgent: data.deviceInfo ?? null },
    });

    if (result.status === "aprovado" && delivery.status === "aguardando_aceite") {
      await supabaseAdmin.from("item_deliveries").update({ status: "em_validacao" }).eq("id", delivery.id);
    }

    await supabaseAdmin.from("item_delivery_events").insert({
      company_id: delivery.company_id,
      delivery_id: delivery.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      actor_label: employee.full_name,
      event_type: "validacao_identidade",
      metadata: { status: result.status, provider: result.provider, liveness: result.liveness },
    });

    return {
      status: result.status,
      liveness: result.liveness,
      message: result.message ?? null,
    };
  });

/** Registra o aceite com assinatura, evidências e hash de integridade. */
export const portalAcceptDelivery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => acceptSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { integrityHash, decodeImageDataUrl } = await import("./face-validation.server");
    const { TERMS_VERSION, CONSENT_VERSION } = await import("./items.shared");

    const { data: delivery } = await supabaseAdmin
      .from("item_deliveries")
      .select("id, company_id, unit_id, status, delivered_at")
      .eq("id", data.deliveryId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!delivery) return { error: "Entrega não encontrada." as const };
    if (delivery.status === "assinado") return { error: "Esta entrega já foi assinada." as const };
    if (delivery.status !== "aguardando_aceite" && delivery.status !== "em_validacao") {
      return { error: "Esta entrega não está disponível para aceite." as const };
    }

    const { data: evidence } = await supabaseAdmin
      .from("item_delivery_evidence")
      .select("face_status")
      .eq("delivery_id", delivery.id)
      .maybeSingle();

    const faceOk = evidence?.face_status === "aprovado";
    if (!faceOk && !data.faceSkipReason) {
      return { error: "Conclua a validação de identidade antes de assinar." as const };
    }

    if (data.signatureType === "desenhada" && !data.signatureDataUrl) {
      return { error: "Assine no campo indicado para continuar." as const };
    }
    if (data.signatureType === "digitada" && (data.typedName ?? "").trim().length < 3) {
      return { error: "Digite seu nome completo para confirmar." as const };
    }

    let signaturePath: string | null = null;
    if (data.signatureDataUrl) {
      const bytes = decodeImageDataUrl(data.signatureDataUrl);
      if (bytes) {
        const path = `${delivery.company_id}/entregas/${delivery.id}/assinatura.png`;
        const { error } = await supabaseAdmin.storage
          .from("signatures")
          .upload(path, bytes, { contentType: "image/png", upsert: true });
        if (!error) signaturePath = path;
      }
    }

    const { data: items } = await supabaseAdmin
      .from("item_delivery_items")
      .select("item_name, quantity, size, color, lot")
      .eq("delivery_id", delivery.id);

    const acceptedAt = new Date().toISOString();
    const hash = await integrityHash({
      deliveryId: delivery.id,
      employeeId: employee.id,
      items,
      acceptedAt,
      termsVersion: TERMS_VERSION,
    });

    await upsertEvidence(supabaseAdmin, delivery.id, {
      signature_type: data.signatureType,
      signature_path: signaturePath,
      signature_typed_name: data.typedName ?? null,
      location_status: data.locationStatus,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      accuracy_meters: data.accuracy ?? null,
      location_captured_at: data.latitude != null ? acceptedAt : null,
      device_metadata: { userAgent: data.deviceInfo ?? null, faceSkipReason: data.faceSkipReason ?? null },
      terms_version: TERMS_VERSION,
      consent_version: CONSENT_VERSION,
      integrity_hash: hash,
      ...(faceOk ? {} : { face_status: "dispensada" }),
    });

    await supabaseAdmin
      .from("item_deliveries")
      .update({ status: "assinado", accepted_at: acceptedAt })
      .eq("id", delivery.id);

    await supabaseAdmin.from("item_delivery_events").insert({
      company_id: delivery.company_id,
      delivery_id: delivery.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      actor_label: employee.full_name,
      event_type: "entrega_assinada",
      metadata: { signature_type: data.signatureType, integrity_hash: hash, face_dispensada: !faceOk },
    });

    return { ok: true, hash, acceptedAt };
  });

/** Recusa a entrega ou registra divergência, notificando a gestão. */
export const portalRefuseDelivery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => refuseSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: delivery } = await supabaseAdmin
      .from("item_deliveries")
      .select("id, company_id, unit_id, status")
      .eq("id", data.deliveryId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!delivery) return { error: "Entrega não encontrada." as const };
    if (delivery.status === "assinado") return { error: "Esta entrega já foi assinada." as const };

    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("item_deliveries")
      .update(
        data.mode === "recusado"
          ? { status: "recusado", refused_at: nowIso, refusal_reason: data.reason }
          : { status: "divergente", divergence_notes: data.reason },
      )
      .eq("id", delivery.id);

    await supabaseAdmin.from("item_delivery_events").insert({
      company_id: delivery.company_id,
      delivery_id: delivery.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      actor_label: employee.full_name,
      event_type: data.mode === "recusado" ? "entrega_recusada" : "divergencia_registrada",
      metadata: { reason: data.reason },
    });

    await supabaseAdmin.from("notifications").insert({
      company_id: delivery.company_id,
      unit_id: delivery.unit_id,
      employee_id: employee.id,
      event_type: data.mode === "recusado" ? "entrega_recusada" : "entrega_divergente",
      channel: "link",
      status: "pendente",
      payload: { delivery_id: delivery.id, reason: data.reason, employee: employee.full_name },
      idempotency_key: `entrega:${delivery.id}:${data.mode}:${nowIso}`,
    });

    return { ok: true };
  });

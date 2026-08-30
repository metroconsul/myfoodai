import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(10).max(200) });
const docSchema = tokenSchema.extend({ documentId: z.string().uuid() });

const geoFields = {
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  locationStatus: z
    .enum(["obtida", "negada", "imprecisa", "indisponivel", "nao_disponivel"])
    .default("nao_disponivel"),
};

const ackSchema = docSchema.extend({
  mode: z.enum(["ciencia", "assinatura"]),
  signatureDataUrl: z.string().max(4_000_000).nullable().optional(),
  typedName: z.string().trim().max(160).nullable().optional(),
  ...geoFields,
  deviceInfo: z.string().max(400).nullable().optional(),
});

const uploadSchema = tokenSchema.extend({
  requestId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(180),
  fileDataUrl: z.string().min(64).max(8_000_000),
});

const exchangeSchema = tokenSchema.extend({
  deliveryId: z.string().uuid().nullable().optional(),
  itemId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(2).max(60),
  requestedSize: z.string().trim().max(40).nullable().optional(),
  requestedColor: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(800).nullable().optional(),
});

const DOC_SELECT =
  "id, company_id, unit_id, employee_id, document_type, title, status, performed_at, expires_at, next_review_at, provider_name, administrative_notes, clinical_access_level, file_path, file_name, request_mode, published_to_portal_at, archived_at, version, next_action, next_action_due_at, updated_at";

async function session(token: string) {
  return (await import("./portal-session.server")).resolveSession(token);
}

function decodeDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1] ?? "application/octet-stream";
  const body = match[3] ?? "";
  if (!match[2]) return { contentType, bytes: new TextEncoder().encode(decodeURIComponent(body)) };
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return { contentType, bytes };
}

/** Documentos ocupacionais publicados para o colaborador logado. */
export const portalMyDocuments = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await session(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: documents }, { data: requests }, { data: acks }] = await Promise.all([
      supabaseAdmin
        .from("occupational_documents")
        .select(DOC_SELECT)
        .eq("employee_id", employee.id)
        .not("published_to_portal_at", "is", null)
        .order("performed_at", { ascending: false, nullsFirst: false }),
      supabaseAdmin
        .from("document_requests")
        .select("id, document_type, request_mode, due_at, status, message, requires_upload, requires_acknowledgement, requires_signature, created_at")
        .eq("employee_id", employee.id)
        .eq("status", "aberta")
        .order("due_at", { nullsFirst: false }),
      supabaseAdmin
        .from("document_acknowledgements")
        .select("document_id, document_version, viewed_at, acknowledged_at, signed_at")
        .eq("employee_id", employee.id),
    ]);

    return {
      documents: documents ?? [],
      requests: requests ?? [],
      acknowledgements: acks ?? [],
    };
  });

/** Detalhe de um documento do próprio colaborador (registra a visualização). */
export const portalDocumentDetail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => docSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await session(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: document } = await supabaseAdmin
      .from("occupational_documents")
      .select(DOC_SELECT)
      .eq("id", data.documentId)
      .eq("employee_id", employee.id)
      .not("published_to_portal_at", "is", null)
      .maybeSingle();
    if (!document) return { error: "Documento não encontrado." as const };

    const { data: ack } = await supabaseAdmin
      .from("document_acknowledgements")
      .select("*")
      .eq("document_id", document.id)
      .eq("document_version", document.version)
      .maybeSingle();

    if (!ack) {
      await supabaseAdmin.from("document_acknowledgements").insert({
        company_id: document.company_id,
        document_id: document.id,
        employee_id: employee.id,
        document_version: document.version,
        viewed_at: new Date().toISOString(),
      });
    } else if (!ack.viewed_at) {
      await supabaseAdmin
        .from("document_acknowledgements")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", ack.id);
    }

    await supabaseAdmin.from("document_access_logs").insert({
      company_id: document.company_id,
      document_id: document.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      event_type: "visualizacao",
      metadata: {},
    });

    return { document, acknowledgement: ack ?? null };
  });

/** URL temporária do arquivo, registrando o download na trilha de auditoria. */
export const portalDocumentFileUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => docSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await session(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: document } = await supabaseAdmin
      .from("occupational_documents")
      .select("id, company_id, file_path")
      .eq("id", data.documentId)
      .eq("employee_id", employee.id)
      .not("published_to_portal_at", "is", null)
      .maybeSingle();
    if (!document?.file_path) return { error: "Arquivo indisponível." as const };

    const { data: signed } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(document.file_path, 300);
    if (!signed?.signedUrl) return { error: "Não foi possível abrir o arquivo agora." as const };

    await supabaseAdmin.from("document_access_logs").insert({
      company_id: document.company_id,
      document_id: document.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      event_type: "download",
      metadata: {},
    });

    return { url: signed.signedUrl };
  });

/** Confirma ciência ou assina eletronicamente o documento. */
export const portalAcknowledgeDocument = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ackSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await session(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { integrityHash, decodeImageDataUrl } = await import("./face-validation.server");
    const { DOC_TERMS_VERSION, DOC_CONSENT_VERSION } = await import("./compliance.shared");

    const { data: document } = await supabaseAdmin
      .from("occupational_documents")
      .select("id, company_id, version, document_type")
      .eq("id", data.documentId)
      .eq("employee_id", employee.id)
      .not("published_to_portal_at", "is", null)
      .maybeSingle();
    if (!document) return { error: "Documento não encontrado." as const };

    if (data.mode === "assinatura" && !data.signatureDataUrl && (data.typedName ?? "").trim().length < 3) {
      return { error: "Assine ou digite seu nome completo para confirmar." as const };
    }

    let signaturePath: string | null = null;
    if (data.signatureDataUrl) {
      const bytes = decodeImageDataUrl(data.signatureDataUrl);
      if (bytes) {
        const path = `${document.company_id}/documentos/${document.id}/assinatura-v${document.version}.png`;
        const { error } = await supabaseAdmin.storage
          .from("signatures")
          .upload(path, bytes, { contentType: "image/png", upsert: true });
        if (!error) signaturePath = path;
      }
    }

    const now = new Date().toISOString();
    const hash = await integrityHash({
      documentId: document.id,
      employeeId: employee.id,
      version: document.version,
      mode: data.mode,
      at: now,
      termsVersion: DOC_TERMS_VERSION,
    });

    const patch = {
      acknowledged_at: now,
      signed_at: data.mode === "assinatura" ? now : null,
      signature_path: signaturePath,
      location_status: data.locationStatus,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      accuracy_meters: data.accuracy ?? null,
      location_captured_at: data.latitude != null ? now : null,
      device_metadata: { userAgent: data.deviceInfo ?? null, typedName: data.typedName ?? null },
      term_version: DOC_TERMS_VERSION,
      consent_version: DOC_CONSENT_VERSION,
      integrity_hash: hash,
    };

    const { data: existing } = await supabaseAdmin
      .from("document_acknowledgements")
      .select("id")
      .eq("document_id", document.id)
      .eq("document_version", document.version)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from("document_acknowledgements").update(patch).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("document_acknowledgements").insert({
        company_id: document.company_id,
        document_id: document.id,
        employee_id: employee.id,
        document_version: document.version,
        viewed_at: now,
        ...patch,
      });
    }

    await supabaseAdmin
      .from("document_requests")
      .update({ status: "concluida", completed_at: now })
      .eq("document_id", document.id)
      .eq("employee_id", employee.id)
      .eq("status", "aberta");

    await supabaseAdmin.from("document_access_logs").insert({
      company_id: document.company_id,
      document_id: document.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      event_type: data.mode === "assinatura" ? "assinatura" : "ciencia",
      metadata: { locationStatus: data.locationStatus },
    });

    return { ok: true as const, integrityHash: hash, signedAt: now };
  });

/** Envio de arquivo pelo colaborador para uma solicitação aberta. */
export const portalUploadRequestedDocument = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => uploadSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await session(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request } = await supabaseAdmin
      .from("document_requests")
      .select("*")
      .eq("id", data.requestId)
      .eq("employee_id", employee.id)
      .eq("status", "aberta")
      .maybeSingle();
    if (!request) return { error: "Solicitação não encontrada." as const };

    const decoded = decodeDataUrl(data.fileDataUrl);
    if (!decoded) return { error: "Arquivo inválido." as const };
    if (decoded.bytes.byteLength > 8_000_000) return { error: "Arquivo maior que o limite." as const };

    const safeName = data.fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
    const path = `${request.company_id}/documentos/${employee.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false });
    if (uploadError) return { error: "Não foi possível enviar o arquivo agora." as const };

    const hashBuf = await crypto.subtle.digest("SHA-256", decoded.bytes as unknown as ArrayBuffer);
    const fileHash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const now = new Date().toISOString();
    let documentId = request.document_id;
    if (documentId) {
      await supabaseAdmin
        .from("occupational_documents")
        .update({
          file_path: path,
          file_name: safeName,
          file_size: decoded.bytes.byteLength,
          file_hash: fileHash,
          status: "em_revisao",
        })
        .eq("id", documentId);
    } else {
      const { data: created } = await supabaseAdmin
        .from("occupational_documents")
        .insert({
          company_id: request.company_id,
          unit_id: request.unit_id,
          employee_id: employee.id,
          document_type: request.document_type,
          title: `Documento enviado pelo colaborador`,
          status: "em_revisao",
          clinical_access_level: "rh_autorizado",
          file_path: path,
          file_name: safeName,
          file_size: decoded.bytes.byteLength,
          file_hash: fileHash,
          is_draft: false,
          published_to_portal_at: now,
        })
        .select("id")
        .maybeSingle();
      documentId = created?.id ?? null;
    }

    await supabaseAdmin
      .from("document_requests")
      .update({ status: "concluida", completed_at: now, document_id: documentId })
      .eq("id", request.id);

    if (documentId) {
      await supabaseAdmin.from("document_access_logs").insert({
        company_id: request.company_id,
        document_id: documentId,
        actor_type: "colaborador",
        actor_id: employee.id,
        event_type: "envio_arquivo",
        metadata: { fileName: safeName },
      });
    }

    return { ok: true as const };
  });

/** Fila única de pendências do colaborador. */
export const portalPendencies = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await session(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: requests }, { data: documents }, { data: deliveries }, { data: cards }, { data: exchanges }] =
      await Promise.all([
        supabaseAdmin
          .from("document_requests")
          .select("id, document_type, request_mode, due_at, message, requires_upload")
          .eq("employee_id", employee.id)
          .eq("status", "aberta"),
        supabaseAdmin
          .from("occupational_documents")
          .select("id, title, document_type, request_mode, next_action_due_at, expires_at, version")
          .eq("employee_id", employee.id)
          .not("published_to_portal_at", "is", null)
          .is("archived_at", null)
          .in("request_mode", ["confirmar_ciencia", "assinar"]),
        supabaseAdmin
          .from("item_deliveries")
          .select("id, delivered_at, status, expires_at")
          .eq("employee_id", employee.id)
          .in("status", ["aguardando_aceite", "em_validacao"]),
        supabaseAdmin
          .from("point_cards")
          .select("id, period_start, period_end, status, deadline_at")
          .eq("employee_id", employee.id)
          .is("signed_at", null)
          .not("published_at", "is", null),
        supabaseAdmin
          .from("uniform_exchange_requests")
          .select("id, status, reason, created_at")
          .eq("employee_id", employee.id)
          .in("status", ["solicitada", "em_analise", "aprovada", "aguardando_devolucao"]),
      ]);

    const acks = await supabaseAdmin
      .from("document_acknowledgements")
      .select("document_id, document_version, acknowledged_at")
      .eq("employee_id", employee.id);
    const done = new Set(
      (acks.data ?? [])
        .filter((a) => a.acknowledged_at)
        .map((a) => `${a.document_id}:${a.document_version}`),
    );

    return {
      requests: requests ?? [],
      documents: (documents ?? []).filter((d) => !done.has(`${d.id}:${d.version}`)),
      deliveries: deliveries ?? [],
      pointCards: cards ?? [],
      exchanges: exchanges ?? [],
    };
  });

/** Solicitação de troca ou devolução feita pelo colaborador. */
export const portalRequestExchange = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => exchangeSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await session(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.deliveryId) {
      const { data: delivery } = await supabaseAdmin
        .from("item_deliveries")
        .select("id")
        .eq("id", data.deliveryId)
        .eq("employee_id", employee.id)
        .maybeSingle();
      if (!delivery) return { error: "Entrega não encontrada." as const };
    }

    const { error } = await supabaseAdmin.from("uniform_exchange_requests").insert({
      company_id: employee.company_id,
      unit_id: employee.unit_id,
      employee_id: employee.id,
      original_delivery_id: data.deliveryId ?? null,
      item_id: data.itemId ?? null,
      requested_size: data.requestedSize ?? null,
      requested_color: data.requestedColor ?? null,
      reason: data.reason,
      description: data.description ?? null,
    });
    if (error) return { error: "Não foi possível registrar a solicitação." as const };
    return { ok: true as const };
  });

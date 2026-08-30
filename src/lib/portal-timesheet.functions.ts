import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(10).max(200) });
const cardSchema = tokenSchema.extend({ cardId: z.string().uuid() });

const geoSchema = {
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  locationStatus: z.enum(["obtida", "negada", "imprecisa", "indisponivel", "nao_disponivel"]),
};

const validateSchema = cardSchema.extend({
  imageDataUrl: z.string().min(64).max(4_000_000),
  ...geoSchema,
  deviceInfo: z.string().max(400).nullable().optional(),
});

const signSchema = cardSchema.extend({
  signatureDataUrl: z.string().max(4_000_000).nullable().optional(),
  typedName: z.string().trim().max(160).nullable().optional(),
  signatureType: z.enum(["desenhada", "digitada"]),
  agreed: z.boolean(),
  ...geoSchema,
  deviceInfo: z.string().max(400).nullable().optional(),
  faceSkipReason: z.string().trim().max(300).nullable().optional(),
});

const disputeSchema = cardSchema.extend({
  workDate: z.string().length(10).nullable().optional(),
  category: z.enum(["entrada", "intervalo", "saida", "falta", "hora_extra", "sem_registro", "outro"]),
  description: z.string().trim().min(5).max(1500),
});

const CARD_FIELDS =
  "id, company_id, unit_id, employee_id, period_start, period_end, status, version, summary, planned_minutes, worked_minutes, overtime_minutes, late_minutes, absence_days, balance_minutes, missing_punches, published_at, viewed_at, signed_at, deadline_at, reopen_reason";

/** Lista os cartões de ponto publicados para o colaborador logado. */
export const portalMyTimesheets = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cards } = await supabaseAdmin
      .from("point_cards")
      .select(CARD_FIELDS)
      .eq("employee_id", employee.id)
      .neq("status", "rascunho")
      .neq("status", "em_revisao")
      .order("period_start", { ascending: false })
      .limit(48);

    const rows = cards ?? [];
    const ids = rows.map((c) => c.id);
    const { data: disputes } = ids.length
      ? await supabaseAdmin.from("timesheet_disputes").select("id, card_id, status").in("card_id", ids)
      : { data: [] as { id: string; card_id: string; status: string }[] };

    const open = ["publicado", "em_validacao", "corrigido", "reaberto"];
    return {
      cards: rows,
      disputes: disputes ?? [],
      pendingCount: rows.filter((c) => open.includes(c.status)).length,
      disputeCount: rows.filter((c) => c.status === "divergente").length,
      lastSigned: rows.find((c) => c.status === "assinado") ?? null,
    };
  });

/** Detalhe do cartão com a grade diária. Registra a visualização. */
export const portalTimesheetCard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cardSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: card } = await supabaseAdmin
      .from("point_cards")
      .select(CARD_FIELDS)
      .eq("id", data.cardId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!card) return { error: "Cartão não encontrado." as const };
    if (card.status === "rascunho" || card.status === "em_revisao") {
      return { error: "Este cartão ainda não foi publicado." as const };
    }

    const [{ data: entries }, { data: disputes }, { data: evidence }, { data: unit }, { data: company }] =
      await Promise.all([
        supabaseAdmin.from("timesheet_entries").select("*").eq("card_id", card.id).order("work_date"),
        supabaseAdmin
          .from("timesheet_disputes")
          .select("*")
          .eq("card_id", card.id)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("point_card_evidence")
          .select("*")
          .eq("card_id", card.id)
          .eq("card_version", card.version ?? 1)
          .maybeSingle(),
        supabaseAdmin.from("units").select("name").eq("id", card.unit_id).maybeSingle(),
        supabaseAdmin.from("companies").select("name").eq("id", card.company_id).maybeSingle(),
      ]);

    if (!card.viewed_at) {
      await supabaseAdmin
        .from("point_cards")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", card.id);
      await supabaseAdmin.from("point_card_events").insert({
        company_id: card.company_id,
        card_id: card.id,
        actor_type: "colaborador",
        actor_id: employee.id,
        actor_label: employee.full_name,
        event_type: "cartao_visualizado",
        metadata: { version: card.version },
      });
    }

    return {
      card,
      entries: entries ?? [],
      disputes: disputes ?? [],
      evidence: evidence ?? null,
      unitName: unit?.name ?? null,
      companyName: company?.name ?? null,
      employeeName: employee.full_name,
      employeeCode: employee.employee_code ?? null,
    };
  });

/** Registra uma divergência antes da assinatura. */
export const portalCreateTimesheetDispute = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => disputeSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: card } = await supabaseAdmin
      .from("point_cards")
      .select("id, company_id, unit_id, status, version")
      .eq("id", data.cardId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!card) return { error: "Cartão não encontrado." as const };
    if (card.status === "assinado") return { error: "Este cartão já foi assinado." as const };

    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin.from("timesheet_disputes").insert({
      card_id: card.id,
      company_id: card.company_id,
      unit_id: card.unit_id,
      employee_id: employee.id,
      card_version: card.version ?? 1,
      work_date: data.workDate ?? null,
      category: data.category,
      description: data.description,
      status: "aberta",
    });
    if (error) return { error: "Não foi possível enviar sua divergência agora." as const };

    await supabaseAdmin.from("point_cards").update({ status: "divergente" }).eq("id", card.id);

    await supabaseAdmin.from("point_card_events").insert({
      company_id: card.company_id,
      card_id: card.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      actor_label: employee.full_name,
      event_type: "divergencia_registrada",
      metadata: { category: data.category, work_date: data.workDate ?? null },
    });

    await supabaseAdmin.from("notifications").insert({
      company_id: card.company_id,
      unit_id: card.unit_id,
      employee_id: employee.id,
      event_type: "cartao_ponto_divergencia",
      channel: "link",
      status: "pendente",
      payload: { card_id: card.id, category: data.category, employee: employee.full_name },
      idempotency_key: `cartao:${card.id}:divergencia:${nowIso}`,
    });

    return { ok: true };
  });

/** Validação facial + prova de vida antes do aceite do cartão. */
export const portalValidateTimesheetIdentity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => validateSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { validateFace } = await import("./face-validation.server");
    const { upsertCardEvidence } = await import("./timesheet.server");

    const { data: card } = await supabaseAdmin
      .from("point_cards")
      .select("id, company_id, status, version")
      .eq("id", data.cardId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!card) return { error: "Cartão não encontrado." as const };
    if (!["publicado", "em_validacao", "corrigido", "reaberto"].includes(card.status)) {
      return { error: "Este cartão não está disponível para assinatura." as const };
    }

    const { result } = await validateFace({
      imageDataUrl: data.imageDataUrl,
      employeeId: employee.id,
      deliveryId: card.id,
    });

    // Não guardamos a imagem facial: apenas o resultado e a referência segura.
    await upsertCardEvidence(supabaseAdmin, card.id, card.version ?? 1, {
      company_id: card.company_id,
      face_status: result.status,
      face_provider: result.provider,
      face_provider_reference: result.reference,
      liveness_status: result.liveness,
      face_validated_at: new Date().toISOString(),
      location_status: data.locationStatus,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      accuracy_meters: data.accuracy ?? null,
      location_captured_at: data.latitude != null ? new Date().toISOString() : null,
      device_metadata: { userAgent: data.deviceInfo ?? null },
    });

    if (result.status === "aprovado" && card.status !== "em_validacao") {
      await supabaseAdmin.from("point_cards").update({ status: "em_validacao" }).eq("id", card.id);
    }

    await supabaseAdmin.from("point_card_events").insert({
      company_id: card.company_id,
      card_id: card.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      actor_label: employee.full_name,
      event_type: "validacao_identidade",
      metadata: { status: result.status, provider: result.provider, liveness: result.liveness },
    });

    return { status: result.status, liveness: result.liveness, message: result.message ?? null };
  });

/** Assina o cartão de ponto e grava as evidências do aceite. */
export const portalSignTimesheet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signSchema.parse(d))
  .handler(async ({ data, context }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    if (!data.agreed) return { error: "Confirme a leitura do termo para assinar." as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { integrityHash, decodeImageDataUrl, maskIp } = await import("./face-validation.server");
    const { upsertCardEvidence } = await import("./timesheet.server");
    const { TIMESHEET_TERMS_VERSION, TIMESHEET_CONSENT_VERSION } = await import("./timesheet.shared");

    const { data: card } = await supabaseAdmin
      .from("point_cards")
      .select("id, company_id, unit_id, status, version, period_start, period_end, summary")
      .eq("id", data.cardId)
      .eq("employee_id", employee.id)
      .maybeSingle();
    if (!card) return { error: "Cartão não encontrado." as const };
    if (card.status === "assinado") return { error: "Este cartão já foi assinado." as const };
    if (!["publicado", "em_validacao", "corrigido", "reaberto"].includes(card.status)) {
      return { error: "Este cartão não está disponível para assinatura." as const };
    }

    const version = card.version ?? 1;
    const { data: evidence } = await supabaseAdmin
      .from("point_card_evidence")
      .select("face_status")
      .eq("card_id", card.id)
      .eq("card_version", version)
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
        const path = `${card.company_id}/cartoes-ponto/${card.id}/v${version}-assinatura.png`;
        const { error } = await supabaseAdmin.storage
          .from("signatures")
          .upload(path, bytes, { contentType: "image/png", upsert: true });
        if (!error) signaturePath = path;
      }
      if (!signaturePath && data.signatureType === "desenhada") {
        return { error: "Não foi possível salvar sua assinatura. Tente novamente." as const };
      }
    }

    const signedAt = new Date().toISOString();
    const hash = await integrityHash({
      cardId: card.id,
      version,
      employeeId: employee.id,
      period: [card.period_start, card.period_end],
      summary: card.summary,
      signedAt,
      termsVersion: TIMESHEET_TERMS_VERSION,
    });

    const forwarded =
      (context as unknown as { request?: Request } | undefined)?.request?.headers?.get("x-forwarded-for")?.split(",")[0] ?? null;

    const saved = await upsertCardEvidence(supabaseAdmin, card.id, version, {
      company_id: card.company_id,
      signature_path: signaturePath,
      signature_typed_name: data.signatureType === "digitada" ? (data.typedName ?? null) : null,
      location_status: data.locationStatus,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      accuracy_meters: data.accuracy ?? null,
      location_captured_at: data.latitude != null ? signedAt : null,
      ip_masked: maskIp(forwarded),
      device_metadata: { userAgent: data.deviceInfo ?? null, faceSkipReason: data.faceSkipReason ?? null },
      terms_version: TIMESHEET_TERMS_VERSION,
      consent_version: TIMESHEET_CONSENT_VERSION,
      integrity_hash: hash,
      signed_at: signedAt,
      ...(faceOk ? {} : { face_status: "dispensada" }),
    });

    // O cartão só muda para "assinado" depois que a evidência foi persistida.
    if (!saved) return { error: "Não foi possível registrar o comprovante. Tente novamente." as const };

    const { error: updateError } = await supabaseAdmin
      .from("point_cards")
      .update({ status: "assinado", signed_at: signedAt, acknowledged_at: signedAt })
      .eq("id", card.id);
    if (updateError) return { error: "Não foi possível concluir o aceite. Tente novamente." as const };

    await supabaseAdmin.from("point_card_events").insert({
      company_id: card.company_id,
      card_id: card.id,
      actor_type: "colaborador",
      actor_id: employee.id,
      actor_label: employee.full_name,
      event_type: "cartao_assinado",
      metadata: { version, integrity_hash: hash, face_dispensada: !faceOk },
    });

    return { ok: true, hash, signedAt };
  });

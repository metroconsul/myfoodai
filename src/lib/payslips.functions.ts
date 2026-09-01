import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fileSchema, batchSchema, createSchema, versionSchema } from "./payslips.functions.schemas";

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

/** Perfil + papéis do usuário autenticado (usado para autorização e auditoria). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function actorContext(context: any) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    context.supabase.from("profiles").select("id, company_id, full_name").eq("id", context.userId).maybeSingle(),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
  ]);
  const roleList: string[] = (roles ?? []).map((r: { role: string }) => r.role);
  const canManage = roleList.some((r) => ["owner", "admin", "hr"].includes(r));
  if (!profile?.company_id) throw new Error("Empresa não encontrada.");
  return { companyId: profile.company_id as string, roleList, canManage, name: profile.full_name as string | null };
}

async function storeVersion(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  companyId: string;
  payslipId: string;
  version: number;
  fileName: string;
  fileDataUrl: string;
  uploadedBy: string;
  correctionReason?: string | null;
}) {
  const { decodeFileDataUrl, extensionFor, sha256Hex, storageKey } = await import("./payslips.server");
  const decoded = decodeFileDataUrl(input.fileDataUrl);
  if (!decoded) throw new Error("Arquivo inválido. Envie PDF, PNG ou JPG.");
  const { ACCEPTED_MIME } = await import("./payslips.shared");
  if (!ACCEPTED_MIME.includes(decoded.mimeType)) {
    throw new Error("Formato não suportado. Aceitamos PDF, PNG ou JPG.");
  }
  const key = storageKey(input.companyId, input.payslipId, input.version, extensionFor(decoded.mimeType));
  const { error } = await input.admin.storage
    .from("payslips")
    .upload(key, decoded.bytes, { contentType: decoded.mimeType, upsert: true });
  if (error) throw new Error("Não foi possível armazenar o documento.");

  const hash = await sha256Hex(decoded.bytes);
  await input.admin
    .from("payslip_versions")
    .update({ is_current: false, superseded_at: new Date().toISOString() })
    .eq("payslip_id", input.payslipId)
    .eq("is_current", true);
  await input.admin.from("payslip_versions").insert({
    payslip_id: input.payslipId,
    company_id: input.companyId,
    version: input.version,
    storage_object_key: key,
    original_file_name: input.fileName.slice(0, 200),
    file_sha256: hash,
    file_size_bytes: decoded.bytes.length,
    mime_type: decoded.mimeType,
    uploaded_by: input.uploadedBy,
    correction_reason: input.correctionReason ?? null,
    is_current: true,
  });
  return { key, hash, size: decoded.bytes.length, mimeType: decoded.mimeType };
}

/** Cria um holerite com a primeira versão do arquivo. */
export const createPayslip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actor = await actorContext(context);
    if (!actor.canManage) throw new Error("Você não tem permissão para publicar holerites.");

    const { data: employee } = await context.supabase
      .from("employees")
      .select("id, company_id, unit_id")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (!employee) throw new Error("Colaborador não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit, hashOrNull } = await import("./payslips.server");
    const meta = await requestMeta();

    const { data: payslip, error } = await supabaseAdmin
      .from("payslips")
      .insert({
        company_id: employee.company_id,
        unit_id: employee.unit_id,
        employee_id: employee.id,
        payroll_period: data.payrollPeriod,
        reference_label: data.referenceLabel ?? null,
        status: "draft",
        current_version: 1,
        acceptance_policy: data.acceptancePolicy,
        due_at: data.dueAt || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !payslip) {
      throw new Error(
        error?.code === "23505"
          ? "Já existe um holerite deste colaborador para a competência informada."
          : "Não foi possível criar o holerite.",
      );
    }

    const audit = {
      companyId: employee.company_id,
      unitId: employee.unit_id,
      actorType: "gestor" as const,
      actorId: context.userId,
      actorRole: actor.roleList.join(","),
      subjectId: payslip.id,
      subjectVersion: 1,
      ipHash: await hashOrNull(meta.ip),
      userAgentHash: await hashOrNull(meta.userAgent),
      permissionSnapshot: { roles: actor.roleList },
    };

    try {
      const stored = await storeVersion({
        admin: supabaseAdmin,
        companyId: employee.company_id,
        payslipId: payslip.id,
        version: 1,
        fileName: data.fileName,
        fileDataUrl: data.fileDataUrl,
        uploadedBy: context.userId,
      });
      await recordAudit(supabaseAdmin, {
        ...audit,
        eventType: "payslip.uploaded",
        metadata: { fileSha256: stored.hash, sizeBytes: stored.size, mimeType: stored.mimeType },
      });
    } catch (e) {
      await supabaseAdmin
        .from("payslips")
        .update({ status: "validation_error", validation_error: (e as Error).message })
        .eq("id", payslip.id);
      await recordAudit(supabaseAdmin, {
        ...audit,
        eventType: "payslip.upload_failed",
        eventResult: "failure",
        metadata: { reason: (e as Error).message },
      });
      throw e;
    }

    await recordAudit(supabaseAdmin, { ...audit, eventType: "payslip.created", metadata: {} });

    if (data.publishNow) {
      await supabaseAdmin
        .from("payslips")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", payslip.id);
      await recordAudit(supabaseAdmin, {
        ...audit,
        eventType: "payslip.published",
        metadata: { policy: data.acceptancePolicy },
      });
    }

    return { id: payslip.id as string };
  });

/** Importação em lote: casa arquivos com colaboradores por matrícula ou CPF. */
export const importPayslipBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => batchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actor = await actorContext(context);
    if (!actor.canManage) throw new Error("Você não tem permissão para importar holerites.");

    const { data: employees } = await context.supabase
      .from("employees")
      .select("id, full_name, company_id, unit_id, employee_code, cpf");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit, hashOrNull } = await import("./payslips.server");
    const meta = await requestMeta();
    const ipHash = await hashOrNull(meta.ip);
    const uaHash = await hashOrNull(meta.userAgent);
    const batchId = crypto.randomUUID();

    const digits = (v?: string | null) => (v ?? "").replace(/\D+/g, "");
    const results: Array<{ file: string; employee: string | null; ok: boolean; message?: string }> = [];

    for (const file of data.files) {
      const key = file.matchKey.trim().toLowerCase();
      const keyDigits = digits(key);
      const employee = (employees ?? []).find(
        (e) =>
          (e.employee_code && e.employee_code.toLowerCase() === key) ||
          (keyDigits.length === 11 && digits(e.cpf) === keyDigits),
      );
      if (!employee) {
        results.push({ file: file.fileName, employee: null, ok: false, message: "Colaborador não localizado." });
        continue;
      }

      const { data: payslip, error } = await supabaseAdmin
        .from("payslips")
        .insert({
          company_id: employee.company_id,
          unit_id: employee.unit_id,
          employee_id: employee.id,
          payroll_period: data.payrollPeriod,
          status: "validating",
          current_version: 1,
          acceptance_policy: data.acceptancePolicy,
          due_at: data.dueAt || null,
          import_batch_id: batchId,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error || !payslip) {
        results.push({
          file: file.fileName,
          employee: employee.full_name,
          ok: false,
          message:
            error?.code === "23505" ? "Já existe holerite para esta competência." : "Falha ao criar registro.",
        });
        continue;
      }

      const base = {
        companyId: employee.company_id,
        unitId: employee.unit_id,
        actorType: "gestor" as const,
        actorId: context.userId,
        actorRole: actor.roleList.join(","),
        subjectId: payslip.id,
        subjectVersion: 1,
        ipHash,
        userAgentHash: uaHash,
        permissionSnapshot: { roles: actor.roleList, batchId },
      };

      try {
        const stored = await storeVersion({
          admin: supabaseAdmin,
          companyId: employee.company_id,
          payslipId: payslip.id,
          version: 1,
          fileName: file.fileName,
          fileDataUrl: file.fileDataUrl,
          uploadedBy: context.userId,
        });
        await supabaseAdmin
          .from("payslips")
          .update(
            data.publishNow
              ? { status: "published", published_at: new Date().toISOString(), validation_error: null }
              : { status: "draft", validation_error: null },
          )
          .eq("id", payslip.id);
        await recordAudit(supabaseAdmin, {
          ...base,
          eventType: "payslip.uploaded",
          metadata: { fileSha256: stored.hash, sizeBytes: stored.size, batchId },
        });
        if (data.publishNow) {
          await recordAudit(supabaseAdmin, { ...base, eventType: "payslip.published", metadata: { batchId } });
        }
        results.push({ file: file.fileName, employee: employee.full_name, ok: true });
      } catch (e) {
        await supabaseAdmin
          .from("payslips")
          .update({ status: "validation_error", validation_error: (e as Error).message })
          .eq("id", payslip.id);
        await recordAudit(supabaseAdmin, {
          ...base,
          eventType: "payslip.validation_failed",
          eventResult: "failure",
          metadata: { reason: (e as Error).message, batchId },
        });
        results.push({
          file: file.fileName,
          employee: employee.full_name,
          ok: false,
          message: (e as Error).message,
        });
      }
    }

    return { batchId, results };
  });

/** Publica holerites em rascunho, liberando o acesso no portal. */
export const publishPayslips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const actor = await actorContext(context);
    if (!actor.canManage) throw new Error("Você não tem permissão para publicar holerites.");

    const { data: rows } = await context.supabase
      .from("payslips")
      .select("id, company_id, unit_id, status, current_version")
      .in("id", data.ids);
    const publishable = (rows ?? []).filter((r) => r.status === "draft" || r.status === "corrected");
    if (!publishable.length) throw new Error("Nenhum holerite disponível para publicação.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit, hashOrNull } = await import("./payslips.server");
    const meta = await requestMeta();
    const ipHash = await hashOrNull(meta.ip);
    const now = new Date().toISOString();

    await supabaseAdmin
      .from("payslips")
      .update({ status: "published", published_at: now })
      .in(
        "id",
        publishable.map((r) => r.id),
      );

    for (const row of publishable) {
      await recordAudit(supabaseAdmin, {
        companyId: row.company_id,
        unitId: row.unit_id,
        actorType: "gestor",
        actorId: context.userId,
        actorRole: actor.roleList.join(","),
        subjectId: row.id,
        subjectVersion: row.current_version,
        eventType: "payslip.published",
        ipHash,
        permissionSnapshot: { roles: actor.roleList },
        metadata: {},
      });
    }
    return { published: publishable.length };
  });

/** Cancela a publicação (o documento deixa de aparecer no portal). */
export const cancelPayslip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ payslipId: z.string().uuid(), reason: z.string().trim().min(3).max(600) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const actor = await actorContext(context);
    if (!actor.canManage) throw new Error("Você não tem permissão para cancelar holerites.");

    const { data: row } = await context.supabase
      .from("payslips")
      .select("id, company_id, unit_id, status, current_version")
      .eq("id", data.payslipId)
      .maybeSingle();
    if (!row) throw new Error("Holerite não encontrado.");
    if (row.status === "signed") throw new Error("Holerites assinados não podem ser cancelados.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit } = await import("./payslips.server");
    await supabaseAdmin
      .from("payslips")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", row.id);
    await recordAudit(supabaseAdmin, {
      companyId: row.company_id,
      unitId: row.unit_id,
      actorType: "gestor",
      actorId: context.userId,
      actorRole: actor.roleList.join(","),
      subjectId: row.id,
      subjectVersion: row.current_version,
      eventType: "payslip.cancelled",
      metadata: { reason: data.reason },
    });
    return { ok: true };
  });

/** Envia uma nova versão corrigida, exigindo novo aceite quando aplicável. */
export const createPayslipVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => versionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actor = await actorContext(context);
    if (!actor.canManage) throw new Error("Você não tem permissão para corrigir holerites.");

    const { data: row } = await context.supabase
      .from("payslips")
      .select("id, company_id, unit_id, current_version, acceptance_policy")
      .eq("id", data.payslipId)
      .maybeSingle();
    if (!row) throw new Error("Holerite não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit } = await import("./payslips.server");
    const version = (row.current_version ?? 1) + 1;
    const stored = await storeVersion({
      admin: supabaseAdmin,
      companyId: row.company_id,
      payslipId: row.id,
      version,
      fileName: data.fileName,
      fileDataUrl: data.fileDataUrl,
      uploadedBy: context.userId,
      correctionReason: data.correctionReason,
    });

    await supabaseAdmin
      .from("payslips")
      .update({
        current_version: version,
        status: "corrected",
        signed_at: null,
        viewed_at: null,
        published_at: null,
      })
      .eq("id", row.id);

    await recordAudit(supabaseAdmin, {
      companyId: row.company_id,
      unitId: row.unit_id,
      actorType: "gestor",
      actorId: context.userId,
      actorRole: actor.roleList.join(","),
      subjectId: row.id,
      subjectVersion: version,
      eventType: "payslip.version_created",
      metadata: { reason: data.correctionReason, fileSha256: stored.hash },
    });
    return { version };
  });

/** URL assinada temporária do documento para o gestor, com auditoria. */
export const payslipFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ payslipId: z.string().uuid(), version: z.number().int().positive().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const actor = await actorContext(context);
    const { data: row } = await context.supabase
      .from("payslips")
      .select("id, company_id, unit_id, current_version")
      .eq("id", data.payslipId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit, hashOrNull } = await import("./payslips.server");
    const meta = await requestMeta();

    if (!row || !actor.canManage) {
      if (row) {
        await recordAudit(supabaseAdmin, {
          companyId: row.company_id,
          unitId: row.unit_id,
          actorType: "gestor",
          actorId: context.userId,
          subjectId: row.id,
          eventType: "payslip.download_denied",
          eventResult: "denied",
          ipHash: await hashOrNull(meta.ip),
          metadata: { roles: actor.roleList },
        });
      }
      throw new Error("Acesso não autorizado ao documento.");
    }

    const version = data.version ?? row.current_version ?? 1;
    const { data: fileRow } = await supabaseAdmin
      .from("payslip_versions")
      .select("storage_object_key, file_sha256, mime_type")
      .eq("payslip_id", row.id)
      .eq("version", version)
      .maybeSingle();
    if (!fileRow) throw new Error("Arquivo não encontrado.");

    const { data: signed, error } = await supabaseAdmin.storage
      .from("payslips")
      .createSignedUrl(fileRow.storage_object_key, 300);
    if (error || !signed) throw new Error("Não foi possível gerar o acesso ao documento.");

    await recordAudit(supabaseAdmin, {
      companyId: row.company_id,
      unitId: row.unit_id,
      actorType: "gestor",
      actorId: context.userId,
      actorRole: actor.roleList.join(","),
      subjectId: row.id,
      subjectVersion: version,
      eventType: "payslip.downloaded",
      ipHash: await hashOrNull(meta.ip),
      userAgentHash: await hashOrNull(meta.userAgent),
      permissionSnapshot: { roles: actor.roleList },
      metadata: { fileSha256: fileRow.file_sha256 },
    });

    return { url: signed.signedUrl, mimeType: fileRow.mime_type, sha256: fileRow.file_sha256 };
  });

/** Responde/encerra uma divergência aberta pelo colaborador. */
export const resolvePayslipDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        disputeId: z.string().uuid(),
        status: z.enum(["em_analise", "aguardando_colaborador", "resolvida", "cancelada"]),
        response: z.string().trim().max(1200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actor = await actorContext(context);
    if (!actor.canManage) throw new Error("Você não tem permissão para tratar divergências.");

    const { data: dispute } = await context.supabase
      .from("payslip_disputes")
      .select("id, payslip_id, company_id, version")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) throw new Error("Divergência não encontrada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAudit } = await import("./payslips.server");
    const closing = data.status === "resolvida" || data.status === "cancelada";

    await supabaseAdmin
      .from("payslip_disputes")
      .update({
        status: data.status,
        hr_response: data.response ?? null,
        resolved_by: closing ? context.userId : null,
        resolved_at: closing ? new Date().toISOString() : null,
      })
      .eq("id", dispute.id);

    if (closing) {
      const { data: open } = await supabaseAdmin
        .from("payslip_disputes")
        .select("id")
        .eq("payslip_id", dispute.payslip_id)
        .in("status", ["aberta", "em_analise", "aguardando_colaborador"]);
      if (!open?.length) {
        await supabaseAdmin.from("payslips").update({ status: "published" }).eq("id", dispute.payslip_id);
      }
    }

    await recordAudit(supabaseAdmin, {
      companyId: dispute.company_id,
      actorType: "gestor",
      actorId: context.userId,
      actorRole: actor.roleList.join(","),
      subjectId: dispute.payslip_id,
      subjectVersion: dispute.version,
      eventType: "payslip.dispute_resolved",
      metadata: { disputeId: dispute.id, status: data.status },
    });
    return { ok: true };
  });

/** Helpers server-only do módulo de Holerites: hash de arquivo e auditoria encadeada. */

const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function sha256Hex(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? enc.encode(input) : input;
  return toHex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

/** Converte data URL em bytes; devolve null quando o formato não é aceito. */
export function decodeFileDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  try {
    const binary = atob(match[2]!);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { mimeType: match[1]!, bytes };
  } catch {
    return null;
  }
}

export function extensionFor(mime: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  return "jpg";
}

/**
 * Caminho no storage privado. Nunca usa nome completo, CPF ou matrícula:
 * apenas identificadores opacos.
 */
export function storageKey(companyId: string, payslipId: string, version: number, ext: string) {
  return `${companyId}/${payslipId}/v${version}.${ext}`;
}

export type AuditInput = {
  companyId: string;
  unitId?: string | null;
  actorType: "gestor" | "colaborador" | "sistema";
  actorId?: string | null;
  actorRole?: string | null;
  subjectId: string;
  subjectType?: string;
  subjectVersion?: number | null;
  eventType: string;
  eventResult?: "success" | "failure" | "denied";
  requestId?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
  permissionSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

/**
 * Registra um evento de auditoria encadeado por hash.
 * O `metadata` nunca deve conter conteúdo do documento, valores salariais,
 * tokens ou biometria bruta.
 */
export async function recordAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  input: AuditInput,
) {
  const occurredAt = new Date().toISOString();
  const { data: previous } = await admin
    .from("payslip_audit_events")
    .select("event_hash")
    .eq("subject_id", input.subjectId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousHash: string | null = previous?.event_hash ?? null;
  const canonical = JSON.stringify({
    companyId: input.companyId,
    subjectId: input.subjectId,
    subjectVersion: input.subjectVersion ?? null,
    eventType: input.eventType,
    eventResult: input.eventResult ?? "success",
    occurredAt,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    metadata: input.metadata ?? {},
    previousHash,
  });

  const eventHash = await sha256Hex(canonical);
  await admin.from("payslip_audit_events").insert({
    company_id: input.companyId,
    unit_id: input.unitId ?? null,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    actor_role: input.actorRole ?? null,
    subject_type: input.subjectType ?? "payslip",
    subject_id: input.subjectId,
    subject_version: input.subjectVersion ?? null,
    event_type: input.eventType,
    event_result: input.eventResult ?? "success",
    occurred_at: occurredAt,
    request_id: input.requestId ?? null,
    ip_hash: input.ipHash ?? null,
    user_agent_hash: input.userAgentHash ?? null,
    permission_snapshot: input.permissionSnapshot ?? null,
    metadata: input.metadata ?? {},
    previous_event_hash: previousHash,
    event_hash: eventHash,
  });
  return eventHash;
}

/** IP e user-agent nunca são gravados em claro na auditoria. */
export async function hashOrNull(value?: string | null) {
  if (!value) return null;
  return sha256Hex(value);
}

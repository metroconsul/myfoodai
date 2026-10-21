import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

const uuidSchema = z.string().uuid();
const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const automationEventSchema = z.object({
  event_id: uuidSchema,
  event_type: z.string().trim().min(1).max(120),
  tenant_id: uuidSchema,
  employee_id: uuidSchema.nullish(),
  timestamp: z.string().datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const dispatchSchema = z.object({
  tenant_id: uuidSchema,
  employee_id: uuidSchema.nullish(),
  manager_id: uuidSchema.nullish(),
  notification_type: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  message: z.string().trim().min(1).max(2_000),
  priority: prioritySchema.default("normal"),
  action_url: z.string().trim().max(500).nullish(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  dedupe_key: z.string().trim().min(1).max(500),
});

export type AutomationEvent = z.infer<typeof automationEventSchema>;
export type DispatchPayload = z.infer<typeof dispatchSchema>;

type Candidate = DispatchPayload;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthorizedAutomationRequest(request: Request) {
  const expected = process.env["MYFOODS_AUTOMATION_TOKEN"];
  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return Boolean(expected && received && safeEqual(received, expected));
}

export async function parseAutomationJson<S extends z.ZodTypeAny>(request: Request, schema: S) {
  try {
    return { data: schema.parse(await request.json()) as z.output<S> } as const;
  } catch (error) {
    return {
      error: error instanceof z.ZodError ? error.flatten() : { formErrors: ["Invalid JSON body"] },
    } as const;
  }
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function validateTenantEmployee(companyId: string, employeeId?: string | null) {
  const supabase = await admin();
  const { data: company } = await supabase.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (!company) return false;
  if (!employeeId) return true;
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();
  return Boolean(employee);
}

export async function claimAutomationEvent(event: AutomationEvent) {
  if (!(await validateTenantEmployee(event.tenant_id, event.employee_id))) {
    return { ok: false as const, status: 403, error: "tenant_employee_mismatch" };
  }
  const supabase = await admin();
  const { error } = await supabase.from("automation_events").insert({
    event_id: event.event_id,
    company_id: event.tenant_id,
    employee_id: event.employee_id ?? null,
    event_type: event.event_type,
    occurred_at: event.timestamp,
    payload: event.payload as Json,
  });
  if (!error) return { ok: true as const, status: 201, accepted: true };
  if (error.code === "23505") return { ok: true as const, status: 200, accepted: false };
  return { ok: false as const, status: 500, error: "event_claim_failed" };
}

export async function processAutomationEvent(event: AutomationEvent, domain: "clock" | "documents" | "epis") {
  const prefix = domain === "clock" ? "clock." : domain === "documents" ? "document." : "epi.";
  if (!event.event_type.startsWith(prefix)) {
    return { ok: false as const, status: 422, error: "event_domain_mismatch" };
  }
  const supabase = await admin();
  const { data, error } = await supabase
    .from("automation_events")
    .update({ status: "processed", processed_at: new Date().toISOString(), error: null })
    .eq("event_id", event.event_id)
    .eq("company_id", event.tenant_id)
    .select("event_id")
    .maybeSingle();
  if (error || !data) return { ok: false as const, status: 404, error: "event_not_claimed" };
  return { ok: true as const, status: 200 };
}

function saoPauloDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayBounds(date: string) {
  return {
    from: new Date(`${date}T00:00:00-03:00`).toISOString(),
    to: new Date(`${date}T23:59:59.999-03:00`).toISOString(),
  };
}

function saoPauloMinutes(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export async function clockCandidates(): Promise<Candidate[]> {
  const supabase = await admin();
  const date = saoPauloDate();
  const bounds = dayBounds(date);
  const now = new Date();
  const nowMinutes = saoPauloMinutes(now);

  const [{ data: employees }, { data: blocks }, { data: entries }, { data: reviews }] = await Promise.all([
    supabase.from("employees").select("id, company_id, unit_id, full_name").eq("employment_status", "ativo"),
    supabase.from("schedule_blocks").select("id, company_id, unit_id, employee_id, start_at, end_at").eq("work_date", date),
    supabase.from("time_entries").select("id, company_id, employee_id, entry_type, server_time, validation_status, geo_status").gte("server_time", bounds.from).lte("server_time", bounds.to).order("server_time", { ascending: true }),
    supabase.from("time_entry_reviews").select("id, company_id, employee_id, status, created_at").eq("status", "pendente"),
  ]);

  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const entriesByEmployee = new Map<string, NonNullable<typeof entries>>();
  for (const entry of entries ?? []) {
    const list = entriesByEmployee.get(entry.employee_id) ?? [];
    list.push(entry);
    entriesByEmployee.set(entry.employee_id, list);
  }

  const candidates: Candidate[] = [];
  for (const block of blocks ?? []) {
    const employee = employeeMap.get(block.employee_id);
    if (!employee || employee.company_id !== block.company_id) continue;
    const employeeEntries = entriesByEmployee.get(block.employee_id) ?? [];
    const startMinutes = saoPauloMinutes(block.start_at);
    const endMinutes = saoPauloMinutes(block.end_at);
    const hasEntry = employeeEntries.some((entry) => entry.entry_type === "entrada");
    const hasExit = employeeEntries.some((entry) => entry.entry_type === "saida");
    const divergent = employeeEntries.some((entry) => entry.validation_status !== "valido" || entry.geo_status === "revisao_necessaria" || entry.geo_status === "fora_do_raio");

    if (!hasEntry && nowMinutes > startMinutes + 30) {
      candidates.push({ tenant_id: block.company_id, employee_id: block.employee_id, notification_type: "CLOCK_REMINDER", title: "Entrada ainda não registrada", message: "Seu horário de entrada já começou. Registre o ponto ou informe uma divergência.", priority: "high", action_url: "/portal/ponto", metadata: { block_id: block.id, work_date: date, kind: "missing_entry" }, dedupe_key: `clock:${block.id}:missing_entry:${date}` });
    }
    if (hasEntry && !hasExit && nowMinutes > endMinutes + 30) {
      candidates.push({ tenant_id: block.company_id, employee_id: block.employee_id, notification_type: "CLOCK_REMINDER", title: "Saída ainda não registrada", message: "Sua jornada prevista terminou e ainda não há registro de saída.", priority: "high", action_url: "/portal/ponto", metadata: { block_id: block.id, work_date: date, kind: "missing_exit" }, dedupe_key: `clock:${block.id}:missing_exit:${date}` });
    }
    if (divergent) {
      candidates.push({ tenant_id: block.company_id, employee_id: block.employee_id, notification_type: "CLOCK_ADJUSTMENT", title: "Ponto precisa de conferência", message: "Encontramos uma divergência em um registro de ponto de hoje.", priority: "high", action_url: "/portal/ponto", metadata: { block_id: block.id, work_date: date, kind: "divergence" }, dedupe_key: `clock:${block.id}:divergence:${date}` });
    }
  }

  for (const review of reviews ?? []) {
    candidates.push({ tenant_id: review.company_id, employee_id: review.employee_id, notification_type: "CLOCK_ADJUSTMENT", title: "Correção de ponto em análise", message: "Seu pedido de correção está aguardando análise da gestão.", priority: "normal", action_url: "/portal/ponto", metadata: { review_id: review.id, kind: "correction_request" }, dedupe_key: `clock:review:${review.id}:pending` });
  }
  return candidates;
}

export async function documentCandidates(): Promise<Candidate[]> {
  const supabase = await admin();
  const today = saoPauloDate();
  const todayMs = new Date(`${today}T00:00:00-03:00`).getTime();
  const { data: documents } = await supabase
    .from("occupational_documents")
    .select("id, company_id, employee_id, title, expires_at, status")
    .is("archived_at", null)
    .not("expires_at", "is", null)
    .not("status", "in", '("cancelado","nao_aplicavel")');
  const candidates: Candidate[] = [];
  for (const document of documents ?? []) {
    if (!document.expires_at) continue;
    const days = Math.ceil((new Date(`${document.expires_at}T00:00:00-03:00`).getTime() - todayMs) / 86_400_000);
    const milestone = days < 0 ? "expired" : days === 0 ? "expires_today" : [30, 15, 7].includes(days) ? `${days}_days` : null;
    if (!milestone) continue;
    const expired = days < 0;
    candidates.push({ tenant_id: document.company_id, employee_id: document.employee_id, notification_type: "DOCUMENT_EXPIRING", title: expired ? "Documento vencido" : "Documento próximo do vencimento", message: expired ? `${document.title} está vencido.` : `${document.title} vence em ${days === 0 ? "menos de um dia" : `${days} dias`}.`, priority: expired || days <= 7 ? "high" : "normal", action_url: "/portal/documentos", metadata: { document_id: document.id, expires_at: document.expires_at, days_until_expiry: days, milestone }, dedupe_key: `document:${document.id}:${document.expires_at}:${milestone}` });
  }
  return candidates;
}

export async function epiCandidates(): Promise<Candidate[]> {
  const supabase = await admin();
  const date = saoPauloDate();
  const { data: deliveries } = await supabase
    .from("item_deliveries")
    .select("id, company_id, employee_id, delivered_at, status")
    .in("status", ["aguardando_aceite", "em_validacao"])
    .is("accepted_at", null)
    .is("cancelled_at", null);
  return (deliveries ?? []).map((delivery) => ({ tenant_id: delivery.company_id, employee_id: delivery.employee_id, notification_type: "EPI_PENDING", title: "EPI aguardando aceite", message: "Confira os itens recebidos e registre seu aceite.", priority: "high" as const, action_url: `/portal/itens/${delivery.id}`, metadata: { delivery_id: delivery.id, delivered_at: delivery.delivered_at }, dedupe_key: `epi:${delivery.id}:pending:${date}` }));
}

export async function managerSummaries(date = saoPauloDate()) {
  const supabase = await admin();
  const bounds = dayBounds(date);
  const { data: companies } = await supabase.from("companies").select("id");
  const summaries = [];
  for (const company of companies ?? []) {
    const [{ data: manager }, activeEmployees, clockDiscrepancies, documentsExpiring, documentsExpired, episPending] = await Promise.all([
      supabase.from("profiles").select("id").eq("company_id", company.id).limit(1).maybeSingle(),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("employment_status", "ativo"),
      supabase.from("time_entries").select("id", { count: "exact", head: true }).eq("company_id", company.id).gte("server_time", bounds.from).lte("server_time", bounds.to).neq("validation_status", "valido"),
      supabase.from("occupational_documents").select("id", { count: "exact", head: true }).eq("company_id", company.id).gte("expires_at", date).lte("expires_at", new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)).is("archived_at", null),
      supabase.from("occupational_documents").select("id", { count: "exact", head: true }).eq("company_id", company.id).lt("expires_at", date).is("archived_at", null),
      supabase.from("item_deliveries").select("id", { count: "exact", head: true }).eq("company_id", company.id).in("status", ["aguardando_aceite", "em_validacao"]),
    ]);
    summaries.push({ tenant_id: company.id, manager_id: manager?.id ?? null, date, active_employees: activeEmployees.count ?? 0, clock_discrepancies: clockDiscrepancies.count ?? 0, documents_expiring: documentsExpiring.count ?? 0, documents_expired: documentsExpired.count ?? 0, epis_pending: episPending.count ?? 0, dedupe_key: `manager-summary:${company.id}:${date}` });
  }
  return summaries;
}

export async function dispatchNotification(payload: DispatchPayload) {
  if (!(await validateTenantEmployee(payload.tenant_id, payload.employee_id))) {
    return { ok: false as const, status: 403, error: "tenant_employee_mismatch" };
  }
  const supabase = await admin();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      company_id: payload.tenant_id,
      employee_id: payload.employee_id ?? null,
      event_type: payload.notification_type.toLowerCase(),
      template: payload.title,
      channel: "link",
      recipient: payload.manager_id ?? null,
      status: "pendente",
      payload: { notification_type: payload.notification_type, title: payload.title, message: payload.message, priority: payload.priority, action_url: payload.action_url ?? null, metadata: payload.metadata as Json },
      idempotency_key: `automation:${payload.dedupe_key}`,
    })
    .select("id")
    .maybeSingle();
  if (!error) return { ok: true as const, status: 201, id: data?.id, duplicate: false };
  if (error.code === "23505") return { ok: true as const, status: 200, duplicate: true };
  return { ok: false as const, status: 500, error: "notification_dispatch_failed" };
}

export async function publishAutomationEvent(input: Omit<AutomationEvent, "event_id" | "timestamp">) {
  const url = process.env["N8N_EVENT_WEBHOOK_URL"];
  const secret = process.env["N8N_WEBHOOK_SECRET"];
  if (!url || !secret) return { delivered: false, reason: "not_configured" } as const;
  const event: AutomationEvent = { ...input, event_id: crypto.randomUUID(), timestamp: new Date().toISOString() };
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-myfoods-secret": secret }, body: JSON.stringify(event), signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`n8n responded ${response.status}`);
    return { delivered: true, eventId: event.event_id } as const;
  } catch (error) {
    console.error("[MyFoods automation] Event delivery failed", error);
    return { delivered: false, reason: "delivery_failed", eventId: event.event_id } as const;
  }
}

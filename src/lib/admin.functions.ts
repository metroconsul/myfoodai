import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const pinSchema = z.object({
  employeeId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,8}$/, "O PIN deve ter de 4 a 8 dígitos."),
});

const cardSchema = z.object({
  employeeId: z.string().uuid(),
  periodStart: z.string().length(10),
  periodEnd: z.string().length(10),
});

const sendSchema = z.object({
  pointCardId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email", "link"]),
  recipient: z.string().trim().min(3).max(200),
});

export const setEmployeePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pinSchema.parse(d))
  .handler(async ({ data, context }) => {
    // RLS garante que só colaboradores da empresa/unidade do usuário são visíveis.
    const { data: employee, error } = await context.supabase
      .from("employees")
      .select("id, company_id, unit_id, full_name")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (error || !employee) throw new Error("Colaborador não encontrado.");

    const { hashPin } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await hashPin(data.pin);
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({
        portal_pin_hash: hash,
        portal_pin_set_at: new Date().toISOString(),
        portal_failed_attempts: 0,
        portal_locked_until: null,
      })
      .eq("id", employee.id);
    if (updateError) throw new Error("Não foi possível definir o PIN.");

    await context.supabase.from("audit_logs").insert({
      company_id: employee.company_id,
      unit_id: employee.unit_id,
      user_id: context.userId,
      action: "pin_definido",
      entity: "employees",
      entity_id: employee.id,
    });
    return { ok: true };
  });

export const generatePointCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cardSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: employee } = await context.supabase
      .from("employees")
      .select("id, company_id, unit_id, full_name")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (!employee || !employee.unit_id) throw new Error("Colaborador não encontrado.");

    const [{ data: blocks }, { data: entries }] = await Promise.all([
      context.supabase
        .from("schedule_blocks")
        .select("id, work_date, start_at, end_at")
        .eq("employee_id", employee.id)
        .gte("work_date", data.periodStart)
        .lte("work_date", data.periodEnd),
      context.supabase
        .from("time_entries")
        .select("id, entry_type, server_time, geo_status")
        .eq("employee_id", employee.id)
        .gte("server_time", `${data.periodStart}T00:00:00Z`)
        .lte("server_time", `${data.periodEnd}T23:59:59Z`)
        .order("server_time", { ascending: true }),
    ]);

    const plannedMinutes = (blocks ?? []).reduce(
      (acc, b) =>
        acc + Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000),
      0,
    );

    const byDay = new Map<string, { entry_type: string; server_time: string }[]>();
    for (const e of entries ?? []) {
      const day = e.server_time.slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), e]);
    }

    let workedMinutes = 0;
    let missingPunches = 0;
    const days: { day: string; punches: number; minutes: number }[] = [];
    for (const [day, list] of byDay) {
      let dayMinutes = 0;
      let openAt: number | null = null;
      for (const e of list) {
        const t = new Date(e.server_time).getTime();
        if (e.entry_type === "entrada" || e.entry_type === "intervalo_retorno") openAt = t;
        if ((e.entry_type === "saida" || e.entry_type === "intervalo_saida") && openAt != null) {
          dayMinutes += Math.round((t - openAt) / 60000);
          openAt = null;
        }
      }
      if (openAt != null) missingPunches += 1;
      workedMinutes += dayMinutes;
      days.push({ day, punches: list.length, minutes: dayMinutes });
    }

    const plannedDays = new Set((blocks ?? []).map((b) => b.work_date));
    for (const d of plannedDays) if (!byDay.has(d)) missingPunches += 1;

    const { data: card, error } = await context.supabase
      .from("point_cards")
      .upsert(
        {
          company_id: employee.company_id,
          unit_id: employee.unit_id,
          employee_id: employee.id,
          period_start: data.periodStart,
          period_end: data.periodEnd,
          planned_minutes: plannedMinutes,
          worked_minutes: workedMinutes,
          late_minutes: Math.max(0, plannedMinutes - workedMinutes),
          missing_punches: missingPunches,
          status: "gerado",
          generated_by: context.userId,
          summary: { days, entries: (entries ?? []).length },
        },
        { onConflict: "employee_id,period_start,period_end" },
      )
      .select("id")
      .single();
    if (error) throw new Error("Não foi possível gerar o cartão de ponto.");

    await context.supabase.from("audit_logs").insert({
      company_id: employee.company_id,
      unit_id: employee.unit_id,
      user_id: context.userId,
      action: "cartao_ponto_gerado",
      entity: "point_cards",
      entity_id: card.id,
    });
    return { pointCardId: card.id };
  });

export const sendPointCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: card } = await context.supabase
      .from("point_cards")
      .select("id, company_id, unit_id, employee_id, period_start, period_end")
      .eq("id", data.pointCardId)
      .maybeSingle();
    if (!card) throw new Error("Cartão de ponto não encontrado.");

    const { newSessionToken, hashToken } = await import("./portal.server");
    const token = newSessionToken();

    const { error } = await context.supabase.from("point_card_deliveries").insert({
      company_id: card.company_id,
      point_card_id: card.id,
      channel: data.channel,
      recipient: data.recipient,
      status: "pendente",
      token_hash: await hashToken(token),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
    });
    if (error) throw new Error("Não foi possível registrar o envio.");

    // Fila idempotente — o provedor de WhatsApp/e-mail é plugado depois.
    await context.supabase.from("notifications").insert({
      company_id: card.company_id,
      unit_id: card.unit_id,
      employee_id: card.employee_id,
      event_type: "cartao_ponto_disponivel",
      template: "point_card_available",
      channel: data.channel,
      recipient: data.recipient,
      status: "pendente",
      idempotency_key: `point_card:${card.id}:${data.channel}:${data.recipient}`,
      payload: { period_start: card.period_start, period_end: card.period_end },
    });

    await context.supabase.from("point_cards").update({ status: "aguardando_ciencia" }).eq("id", card.id);
    await context.supabase.from("audit_logs").insert({
      company_id: card.company_id,
      unit_id: card.unit_id,
      user_id: context.userId,
      action: "cartao_ponto_enviado",
      entity: "point_cards",
      entity_id: card.id,
      metadata: { channel: data.channel },
    });
    return { ok: true };
  });

const bootstrapSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  brandName: z.string().trim().max(120).optional(),
  unitName: z.string().trim().min(2).max(120),
  unitType: z.enum([
    "restaurante",
    "bar",
    "cafeteria",
    "lanchonete",
    "padaria",
    "cozinha",
    "varejo",
    "outro",
  ]),
  city: z.string().trim().max(120).optional(),
  fullName: z.string().trim().max(120).optional(),
});

/** Cria empresa, primeira unidade, política de ponto padrão e vincula o usuário como owner. */
export const bootstrapCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bootstrapSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (existing?.company_id) return { companyId: existing.company_id, created: false };

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({ name: data.companyName, brand_name: data.brandName ?? data.companyName })
      .select("id")
      .single();
    if (companyError || !company) throw new Error("Não foi possível criar a empresa.");

    const { data: unit, error: unitError } = await supabaseAdmin
      .from("units")
      .insert({
        company_id: company.id,
        name: data.unitName,
        type: data.unitType,
        city: data.city ?? null,
      })
      .select("id")
      .single();
    if (unitError || !unit) throw new Error("Não foi possível criar a unidade.");

    await supabaseAdmin.from("point_policies").insert({ company_id: company.id, unit_id: null });

    await supabaseAdmin.from("profiles").upsert({
      id: context.userId,
      company_id: company.id,
      active_unit_id: unit.id,
      full_name: data.fullName ?? null,
      email: (context.claims as { email?: string } | null)?.email ?? null,
    });

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, company_id: company.id, role: "owner" });
    await supabaseAdmin.from("user_units").insert({ user_id: context.userId, unit_id: unit.id });

    await supabaseAdmin.from("audit_logs").insert({
      company_id: company.id,
      unit_id: unit.id,
      user_id: context.userId,
      action: "empresa_criada",
      entity: "companies",
      entity_id: company.id,
    });

    return { companyId: company.id, created: true };
  });

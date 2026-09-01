import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { provisionSchema } from "./pilot.functions.schemas";

/**
 * Provisionamento de contas piloto.
 * Apenas a conta administradora da plataforma pode executar.
 * Nenhuma senha é recebida, gravada ou registrada: o acesso é criado por
 * convite, e o próprio usuário define a senha pelo link enviado.
 */


export const listPilotAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requirePlatformAdmin } = await import("./plan.server");
    await requirePlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("companies")
      .select(
        "id, name, plan_code, billing_cycle, subscription_status, access_source, pilot_account, trial_ends_at, grant_reason, created_at",
      )
      .eq("pilot_account", true)
      .order("created_at", { ascending: false });
    return { companies: data ?? [] };
  });

export const provisionPilotAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => provisionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { requirePlatformAdmin } = await import("./plan.server");
    await requirePlatformAdmin(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Convite: cria o usuário no Auth sem senha. O convidado define a dele.
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { redirectTo: `${data.redirectOrigin}/auth?convite=1` },
    );

    let userId = invited?.user?.id ?? null;
    if (inviteError || !userId) {
      // Usuário já existe: reaproveita a conta e envia recuperação de senha.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find(
        (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
      );
      if (!found) throw new Error("Não foi possível enviar o convite para este e-mail.");
      userId = found.id;
    }

    // 2) Empresa piloto isolada, com plano Começo.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.company_id) {
      return { ok: true, alreadyProvisioned: true, companyId: profile.company_id, userId };
    }

    const now = new Date();
    const trialEnds =
      data.accessMode === "trial"
        ? new Date(now.getTime() + (data.trialDays ?? 30) * 86_400_000).toISOString()
        : null;

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: data.organizationName,
        brand_name: data.organizationName,
        plan_code: "comeco",
        billing_cycle: data.billingCycle,
        pilot_account: true,
        single_unit_mode: true,
        fixed_schedule_mode: true,
        access_source: data.accessMode,
        subscription_status:
          data.accessMode === "trial"
            ? "trialing"
            : data.accessMode === "admin_grant"
              ? "active"
              : "incomplete",
        trial_starts_at: data.accessMode === "trial" ? now.toISOString() : null,
        trial_ends_at: trialEnds,
        grant_reason: data.accessMode === "admin_grant" ? (data.grantReason ?? null) : null,
        granted_by: data.accessMode === "admin_grant" ? context.userId : null,
      })
      .select("id")
      .single();
    if (companyError || !company) throw new Error("Não foi possível criar a organização piloto.");

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
    if (unitError || !unit) throw new Error("Não foi possível criar a unidade piloto.");

    await supabaseAdmin.from("point_policies").insert({ company_id: company.id, unit_id: null });

    const hasBreak = Boolean(data.breakStart && data.breakEnd);
    await supabaseAdmin.from("fixed_work_schedules").upsert(
      {
        company_id: company.id,
        unit_id: unit.id,
        name: "Jornada fixa",
        weekdays: data.weekdays,
        start_time: data.startTime,
        end_time: data.endTime,
        break_start: hasBreak ? data.breakStart! : null,
        break_end: hasBreak ? data.breakEnd! : null,
        active: true,
      },
      { onConflict: "unit_id" },
    );

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      company_id: company.id,
      active_unit_id: unit.id,
      full_name: data.responsibleName ?? null,
      email: data.email,
    });

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, company_id: company.id, role: "owner" });
    await supabaseAdmin.from("user_units").insert({ user_id: userId, unit_id: unit.id });

    await supabaseAdmin.from("audit_logs").insert({
      company_id: company.id,
      unit_id: unit.id,
      user_id: context.userId,
      action: "conta_piloto_provisionada",
      entity: "companies",
      entity_id: company.id,
      metadata: {
        access_mode: data.accessMode,
        billing_cycle: data.billingCycle,
        trial_ends_at: trialEnds,
        invited_email: data.email,
      },
    });

    return { ok: true, alreadyProvisioned: false, companyId: company.id, userId };
  });

/** Reenvia o link de acesso. Se o e-mail ainda não tem conta, envia o convite. */
export const resendPilotInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ email: z.string().email().max(200), redirectOrigin: z.string().url().max(200) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requirePlatformAdmin } = await import("./plan.server");
    await requirePlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());

    if (!found) {
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: `${data.redirectOrigin}/auth?convite=1`,
      });
      if (error) throw new Error("Não foi possível enviar o convite para este e-mail.");
      return { ok: true, mode: "invite" as const };
    }

    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error("Não foi possível gerar o link de acesso.");
    return { ok: true, mode: "recovery" as const };
  });


import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { provisionSchema } from "./pilot.functions.schemas";

/**
 * Provisionamento de contas piloto.
 * Apenas a conta administradora da plataforma pode executar.
 * A conta já é criada com e-mail confirmado e uma senha provisória gerada
 * aleatoriamente no servidor. A senha é devolvida uma única vez ao fundador,
 * junto com o link de acesso, e nunca é gravada em tabelas ou logs.
 */

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out}!7`;
}


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

    // 1) Cria a conta já confirmada, com senha provisória gerada no servidor.
    const tempPassword = generateTempPassword();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.responsibleName ?? null, pilot: true },
    });

    let userId = created?.user?.id ?? null;
    let passwordIssued: string | null = userId ? tempPassword : null;

    if (!userId) {
      // Conta já existe: reaproveita e redefine a senha provisória.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find(
        (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
      );
      if (!found) throw new Error(createError?.message ?? "Não foi possível criar a conta.");
      userId = found.id;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        email_confirm: true,
      });
      passwordIssued = updErr ? null : tempPassword;
    }

    // Link de acesso (confirmação) para acompanhar a senha.
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
      options: { redirectTo: `${data.redirectOrigin}/auth?convite=1` },
    });
    const accessLink = linkData?.properties?.action_link ?? `${data.redirectOrigin}/auth`;

    // 2) Empresa piloto isolada, com plano Começo.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.company_id) {
      return {
        ok: true,
        alreadyProvisioned: true,
        companyId: profile.company_id,
        userId,
        email: data.email,
        password: passwordIssued,
        accessLink,
      };
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

    return {
      ok: true,
      alreadyProvisioned: false,
      companyId: company.id,
      userId,
      email: data.email,
      password: passwordIssued,
      accessLink,
    };
  });

/** Reenvia o acesso: garante a conta, gera nova senha provisória e novo link. */
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

    const password = generateTempPassword();
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());

    let mode: "invite" | "recovery" = "recovery";
    if (!found) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password,
        email_confirm: true,
      });
      if (error) throw new Error("Não foi possível criar a conta para este e-mail.");
      mode = "invite";
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(found.id, {
        password,
        email_confirm: true,
      });
      if (error) throw new Error("Não foi possível redefinir a senha desta conta.");
    }

    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
      options: { redirectTo: `${data.redirectOrigin}/auth?convite=1` },
    });

    return {
      ok: true,
      mode,
      email: data.email,
      password,
      accessLink: linkData?.properties?.action_link ?? `${data.redirectOrigin}/auth`,
    };
  });

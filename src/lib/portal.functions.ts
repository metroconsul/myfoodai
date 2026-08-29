import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const loginSchema = z.object({
  cpf: z.string().min(11).max(20),
  pin: z.string().min(4).max(12),
});

const tokenSchema = z.object({ token: z.string().min(10).max(200) });

const rangeSchema = tokenSchema.extend({
  from: z.string().min(10).max(10),
  to: z.string().min(10).max(10),
});

const punchSchema = tokenSchema.extend({
  entryType: z.enum(["entrada", "intervalo_saida", "intervalo_retorno", "saida"]),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  deviceTime: z.string().nullable().optional(),
  userAgent: z.string().max(400).nullable().optional(),
});

const correctionSchema = tokenSchema.extend({
  timeEntryId: z.string().uuid().nullable().optional(),
  requestedTime: z.string().nullable().optional(),
  requestedEntryType: z
    .enum(["entrada", "intervalo_saida", "intervalo_retorno", "saida"])
    .nullable()
    .optional(),
  reason: z.string().trim().min(3).max(500),
});

const ackSchema = tokenSchema.extend({
  pointCardId: z.string().uuid(),
});

export const portalLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin, verifyPin, newSessionToken, hashToken, onlyDigits } = await import(
      "./portal.server"
    );
    void hashPin;
    const cpf = onlyDigits(data.cpf);

    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, company_id, unit_id, portal_pin_hash, portal_failed_attempts, portal_locked_until, employment_status")
      .eq("cpf", cpf)
      .maybeSingle();

    const genericError = { error: "CPF ou PIN inválidos." as const };
    if (!employee) return genericError;
    if (employee.employment_status === "desligado") return { error: "Acesso indisponível." };
    if (employee.portal_locked_until && new Date(employee.portal_locked_until) > new Date()) {
      return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
    }

    const ok = await verifyPin(data.pin, employee.portal_pin_hash);
    if (!ok) {
      const attempts = (employee.portal_failed_attempts ?? 0) + 1;
      await supabaseAdmin
        .from("employees")
        .update({
          portal_failed_attempts: attempts,
          portal_locked_until:
            attempts >= 5 ? new Date(Date.now() + 10 * 60_000).toISOString() : null,
        })
        .eq("id", employee.id);
      return genericError;
    }

    const token = newSessionToken();
    await supabaseAdmin.from("portal_sessions").insert({
      employee_id: employee.id,
      token_hash: await hashToken(token),
      expires_at: new Date(Date.now() + 12 * 60 * 60_000).toISOString(),
    });
    await supabaseAdmin
      .from("employees")
      .update({ portal_failed_attempts: 0, portal_locked_until: null })
      .eq("id", employee.id);

    await supabaseAdmin.from("audit_logs").insert({
      company_id: employee.company_id,
      unit_id: employee.unit_id,
      actor_label: employee.full_name,
      action: "portal_login",
      entity: "employees",
      entity_id: employee.id,
    });

    return { token, name: employee.full_name };
  });

export const portalMe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const [{ data: unit }, { data: nextBlocks }, { data: lastEntries }, { data: company }] =
      await Promise.all([
        supabaseAdmin
          .from("units")
          .select("id, name, type, point_radius_meters, latitude, longitude")
          .eq("id", employee.unit_id ?? "")
          .maybeSingle(),
        supabaseAdmin
          .from("schedule_blocks")
          .select("id, work_date, start_at, end_at, shift_id, shifts(name, color)")
          .eq("employee_id", employee.id)
          .gte("end_at", now.toISOString())
          .order("start_at", { ascending: true })
          .limit(5),
        supabaseAdmin
          .from("time_entries")
          .select("id, entry_type, server_time, geo_status")
          .eq("employee_id", employee.id)
          .order("server_time", { ascending: false })
          .limit(6),
        supabaseAdmin
          .from("companies")
          .select("brand_name, name, primary_color, accent_color")
          .eq("id", employee.company_id)
          .maybeSingle(),
      ]);

    return {
      employee: {
        id: employee.id,
        name: employee.full_name,
        code: employee.employee_code,
        avatarUrl: employee.avatar_url,
      },
      unit,
      company,
      nextBlocks: nextBlocks ?? [],
      lastEntries: lastEntries ?? [],
    };
  });

export const portalSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: blocks } = await supabaseAdmin
      .from("schedule_blocks")
      .select("id, work_date, start_at, end_at, notes, shifts(name, color), schedules(status)")
      .eq("employee_id", employee.id)
      .gte("work_date", data.from)
      .lte("work_date", data.to)
      .order("start_at", { ascending: true });
    return { blocks: (blocks ?? []).filter((b) => b.schedules?.status !== "rascunho") };
  });

export const portalTimeEntries = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: entries } = await supabaseAdmin
      .from("time_entries")
      .select("id, entry_type, server_time, device_time, geo_status, validation_status")
      .eq("employee_id", employee.id)
      .gte("server_time", `${data.from}T00:00:00Z`)
      .lte("server_time", `${data.to}T23:59:59Z`)
      .order("server_time", { ascending: false });
    return { entries: entries ?? [] };
  });

export const portalPunch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => punchSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    if (!employee.unit_id) return { error: "Colaborador sem unidade vinculada." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { haversineMeters } = await import("./portal.server");

    const [{ data: unit }, { data: policy }] = await Promise.all([
      supabaseAdmin
        .from("units")
        .select("id, latitude, longitude, point_radius_meters")
        .eq("id", employee.unit_id)
        .maybeSingle(),
      supabaseAdmin
        .from("point_policies")
        .select("*")
        .eq("company_id", employee.company_id)
        .or(`unit_id.eq.${employee.unit_id},unit_id.is.null`)
        .order("unit_id", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const hasCoords = data.latitude != null && data.longitude != null;
    if (!hasCoords && policy?.geolocation_required && policy?.block_outside_radius) {
      return { error: "A empresa exige localização para registrar o ponto." };
    }

    let geoStatus: "dentro_do_raio" | "fora_do_raio" | "localizacao_indisponivel" | "revisao_necessaria" =
      "localizacao_indisponivel";
    let distance: number | null = null;

    if (hasCoords && unit?.latitude != null && unit?.longitude != null) {
      distance = haversineMeters(
        Number(unit.latitude),
        Number(unit.longitude),
        data.latitude!,
        data.longitude!,
      );
      const tolerance = policy?.accuracy_tolerance_meters ?? 100;
      const radius = unit.point_radius_meters ?? 150;
      geoStatus = distance <= radius + tolerance ? "dentro_do_raio" : "fora_do_raio";
    } else if (hasCoords) {
      geoStatus = "revisao_necessaria";
    } else if (policy?.geolocation_required) {
      geoStatus = "revisao_necessaria";
    }

    if (geoStatus === "fora_do_raio" && policy?.block_outside_radius) {
      return { error: "Você está fora do raio permitido para bater ponto nesta unidade." };
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const { data: block } = await supabaseAdmin
      .from("schedule_blocks")
      .select("id, schedule_id")
      .eq("employee_id", employee.id)
      .eq("work_date", today)
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: inserted, error } = await supabaseAdmin
      .from("time_entries")
      .insert({
        company_id: employee.company_id,
        unit_id: employee.unit_id,
        employee_id: employee.id,
        entry_type: data.entryType,
        device_time: data.deviceTime ?? null,
        server_time: nowIso,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        accuracy_meters: data.accuracy ?? null,
        distance_meters: distance,
        geo_status: geoStatus,
        user_agent: data.userAgent ?? null,
        validation_status: geoStatus === "fora_do_raio" ? "revisao" : "valido",
        schedule_block_id: block?.id ?? null,
        schedule_id: block?.schedule_id ?? null,
      })
      .select("id, entry_type, server_time, geo_status")
      .single();

    if (error) return { error: "Não foi possível registrar o ponto." };

    await supabaseAdmin.from("audit_logs").insert({
      company_id: employee.company_id,
      unit_id: employee.unit_id,
      actor_label: employee.full_name,
      action: "ponto_registrado",
      entity: "time_entries",
      entity_id: inserted.id,
      metadata: { entry_type: data.entryType, geo_status: geoStatus },
    });

    return { entry: inserted, geoStatus };
  });

export const portalPointCards = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cards } = await supabaseAdmin
      .from("point_cards")
      .select(
        "id, period_start, period_end, planned_minutes, worked_minutes, late_minutes, missing_punches, status, acknowledged_at, summary",
      )
      .eq("employee_id", employee.id)
      .order("period_start", { ascending: false })
      .limit(12);
    return { cards: cards ?? [] };
  });

export const portalAcknowledgePointCard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ackSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("point_cards")
      .update({ acknowledged_at: new Date().toISOString(), status: "ciente" })
      .eq("id", data.pointCardId)
      .eq("employee_id", employee.id);
    if (error) return { error: "Não foi possível confirmar." };
    await supabaseAdmin.from("audit_logs").insert({
      company_id: employee.company_id,
      unit_id: employee.unit_id,
      actor_label: employee.full_name,
      action: "cartao_ponto_ciencia",
      entity: "point_cards",
      entity_id: data.pointCardId,
    });
    return { ok: true };
  });

export const portalRequestCorrection = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => correctionSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("time_entry_reviews").insert({
      company_id: employee.company_id,
      unit_id: employee.unit_id,
      employee_id: employee.id,
      time_entry_id: data.timeEntryId ?? null,
      requested_time: data.requestedTime ?? null,
      requested_entry_type: data.requestedEntryType ?? null,
      reason: data.reason,
    });
    if (error) return { error: "Não foi possível enviar a solicitação." };
    return { ok: true };
  });

export const portalDeliveries = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const employee = await (await import("./portal-session.server")).resolveSession(data.token);
    if (!employee) return { error: "Sessão expirada." as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: deliveries } = await supabaseAdmin
      .from("employee_item_deliveries")
      .select("id, quantity, size, condition, delivered_at, returned_at, catalog_items(name, item_type, photo_url)")
      .eq("employee_id", employee.id)
      .order("delivered_at", { ascending: false });
    return { deliveries: deliveries ?? [] };
  });

export const portalLogout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashToken } = await import("./portal.server");
    await supabaseAdmin
      .from("portal_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", await hashToken(data.token));
    return { ok: true };
  });

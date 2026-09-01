import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const saveSchema = z.object({
  unitId: z.string().uuid(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(timeRegex, "Horário inválido."),
  endTime: z.string().regex(timeRegex, "Horário inválido."),
  breakStart: z.string().regex(timeRegex).nullable().optional(),
  breakEnd: z.string().regex(timeRegex).nullable().optional(),
});

/** Lê a jornada fixa da unidade (a RLS restringe à empresa do usuário). */
export const getFixedSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unitId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("fixed_work_schedules")
      .select("*")
      .eq("unit_id", data.unitId)
      .maybeSingle();
    return { schedule: row ?? null };
  });

/** Cria ou atualiza a jornada fixa da unidade. Nenhum horário é presumido. */
export const saveFixedSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { requireFeature } = await import("./plan.server");
    const companyId = await requireFeature(context.userId, "fixed_schedule");

    const { data: unit } = await context.supabase
      .from("units")
      .select("id, company_id")
      .eq("id", data.unitId)
      .maybeSingle();
    if (!unit || unit.company_id !== companyId) throw new Error("Unidade não encontrada.");

    const hasBreak = Boolean(data.breakStart && data.breakEnd);
    const { error } = await context.supabase.from("fixed_work_schedules").upsert(
      {
        company_id: companyId,
        unit_id: data.unitId,
        weekdays: data.weekdays,
        start_time: data.startTime,
        end_time: data.endTime,
        break_start: hasBreak ? data.breakStart! : null,
        break_end: hasBreak ? data.breakEnd! : null,
        active: true,
      },
      { onConflict: "unit_id" },
    );
    if (error) throw new Error("Não foi possível salvar a jornada fixa.");

    await context.supabase.from("audit_logs").insert({
      company_id: companyId,
      unit_id: data.unitId,
      user_id: context.userId,
      action: "jornada_fixa_salva",
      entity: "fixed_work_schedules",
      entity_id: data.unitId,
      metadata: {
        weekdays: data.weekdays,
        start_time: data.startTime,
        end_time: data.endTime,
        break: hasBreak,
      },
    });

    return { ok: true };
  });

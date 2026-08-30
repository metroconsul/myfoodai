import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const periodSchema = z.object({
  unitId: z.string().uuid(),
  periodStart: z.string().length(10),
  periodEnd: z.string().length(10),
});

const prepareSchema = periodSchema.extend({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
  deadlineAt: z.string().max(40).nullable().optional(),
  timezone: z.string().max(60).default("America/Sao_Paulo"),
});

const publishSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(500),
  force: z.boolean().default(false),
});

const entryPatchSchema = z.object({
  entryId: z.string().uuid(),
  clockIn: z.string().max(40).nullable().optional(),
  breakStart: z.string().max(40).nullable().optional(),
  breakEnd: z.string().max(40).nullable().optional(),
  clockOut: z.string().max(40).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  justification: z.string().trim().max(500).nullable().optional(),
});

/** Colaboradores e cartões existentes de uma unidade no período. */
export const listTimesheetPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: employees }, { data: cards }] = await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name, employee_code, employment_status, unit_id, role_id, team_id, roles(name), teams(name)")
        .eq("unit_id", data.unitId)
        .order("full_name"),
      supabase
        .from("point_cards")
        .select(
          "id, employee_id, unit_id, period_start, period_end, status, version, planned_minutes, worked_minutes, overtime_minutes, late_minutes, absence_days, balance_minutes, missing_punches, published_at, viewed_at, signed_at, deadline_at, updated_at, summary, period_id, publish_error",
        )
        .eq("unit_id", data.unitId)
        .eq("period_start", data.periodStart)
        .eq("period_end", data.periodEnd),
    ]);

    const cardIds = (cards ?? []).map((c) => c.id);
    const { data: disputes } = cardIds.length
      ? await supabase
          .from("timesheet_disputes")
          .select("id, card_id, status, category, work_date, description, created_at")
          .in("card_id", cardIds)
      : { data: [] as never[] };

    return {
      employees: employees ?? [],
      cards: cards ?? [],
      disputes: disputes ?? [],
    };
  });

/** Gera (ou regenera) cartões em rascunho a partir dos registros de ponto. */
export const prepareTimesheetCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => prepareSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { buildEntries, eachDate, logCardEvent } = await import("./timesheet.server");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) return { error: "Empresa não encontrada." };
    const companyId = profile.company_id;

    const { data: unit } = await supabase
      .from("units")
      .select("id, name, company_id")
      .eq("id", data.unitId)
      .maybeSingle();
    if (!unit || unit.company_id !== companyId) return { error: "Unidade não encontrada." };

    let { data: period } = await supabase
      .from("timesheet_periods")
      .select("id, status")
      .eq("unit_id", data.unitId)
      .eq("period_start", data.periodStart)
      .eq("period_end", data.periodEnd)
      .maybeSingle();

    if (!period) {
      const { data: created, error } = await supabase
        .from("timesheet_periods")
        .insert({
          company_id: companyId,
          unit_id: data.unitId,
          period_start: data.periodStart,
          period_end: data.periodEnd,
          deadline_at: data.deadlineAt ?? null,
          timezone: data.timezone,
          created_by: userId,
          status: "rascunho",
        })
        .select("id, status")
        .single();
      if (error) return { error: "Não foi possível criar o período de fechamento." };
      period = created;
    } else if (data.deadlineAt) {
      await supabase.from("timesheet_periods").update({ deadline_at: data.deadlineAt }).eq("id", period.id);
    }

    const dates = eachDate(data.periodStart, data.periodEnd);
    const fromIso = `${data.periodStart}T00:00:00.000Z`;
    const toIso = `${data.periodEnd}T23:59:59.999Z`;

    const [{ data: punches }, { data: blocks }] = await Promise.all([
      supabase
        .from("time_entries")
        .select("employee_id, entry_type, server_time")
        .eq("unit_id", data.unitId)
        .in("employee_id", data.employeeIds)
        .gte("server_time", fromIso)
        .lte("server_time", toIso),
      supabase
        .from("schedule_blocks")
        .select("employee_id, work_date, start_at, end_at")
        .eq("unit_id", data.unitId)
        .in("employee_id", data.employeeIds)
        .gte("work_date", data.periodStart)
        .lte("work_date", data.periodEnd),
    ]);

    const created: string[] = [];
    const skipped: { employeeId: string; reason: string }[] = [];

    for (const employeeId of data.employeeIds) {
      const { data: existing } = await supabase
        .from("point_cards")
        .select("id, status, version")
        .eq("employee_id", employeeId)
        .eq("period_start", data.periodStart)
        .eq("period_end", data.periodEnd)
        .maybeSingle();

      if (existing && existing.status === "assinado") {
        skipped.push({ employeeId, reason: "Cartão já assinado. Reabra para gerar nova versão." });
        continue;
      }

      const { entries, summary } = buildEntries({
        dates,
        timeZone: data.timezone,
        punches: (punches ?? []).filter((p) => p.employee_id === employeeId),
        blocks: (blocks ?? []).filter((b) => b.employee_id === employeeId),
      });

      const cardPayload = {
        company_id: companyId,
        unit_id: data.unitId,
        employee_id: employeeId,
        period_id: period!.id,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        status: "rascunho",
        summary: summary as never,
        planned_minutes: summary.planned_minutes,
        worked_minutes: summary.worked_minutes,
        overtime_minutes: summary.overtime_minutes,
        late_minutes: summary.late_minutes,
        absence_days: summary.absence_days,
        balance_minutes: summary.balance_minutes,
        missing_punches: summary.missing_punches,
        deadline_at: data.deadlineAt ?? null,
        generated_by: userId,
        publish_error: null,
      };

      let cardId = existing?.id ?? null;
      if (cardId) {
        await supabase.from("point_cards").update(cardPayload).eq("id", cardId);
        await supabase.from("timesheet_entries").delete().eq("card_id", cardId);
      } else {
        const { data: inserted, error } = await supabase
          .from("point_cards")
          .insert(cardPayload)
          .select("id")
          .single();
        if (error || !inserted) {
          skipped.push({ employeeId, reason: "Falha ao criar o cartão." });
          continue;
        }
        cardId = inserted.id;
      }

      const { error: entriesError } = await supabase
        .from("timesheet_entries")
        .insert(entries.map((e) => ({ ...e, card_id: cardId, company_id: companyId })) as never);
      if (entriesError) {
        skipped.push({ employeeId, reason: "Falha ao gravar os lançamentos diários." });
        continue;
      }

      created.push(cardId!);
      await logCardEvent(supabase, {
        company_id: companyId,
        card_id: cardId,
        period_id: period!.id,
        actor_id: userId,
        actor_label: profile.full_name,
        event_type: "cartao_preparado",
        metadata: { alerts: summary.alerts },
      });
    }

    return { ok: true, periodId: period!.id, created: created.length, skipped };
  });

/** Detalhe completo de um cartão: lançamentos, divergências, evidências e auditoria. */
export const getPointCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cardId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: card } = await supabase
      .from("point_cards")
      .select(
        "id, company_id, unit_id, employee_id, period_id, period_start, period_end, status, version, summary, planned_minutes, worked_minutes, overtime_minutes, late_minutes, absence_days, balance_minutes, missing_punches, published_at, viewed_at, signed_at, reopened_at, reopen_reason, deadline_at, publish_error, updated_at, employees(full_name, employee_code, cpf, roles(name)), units(name)",
      )
      .eq("id", data.cardId)
      .maybeSingle();
    if (!card) return { error: "Cartão não encontrado." };

    const [{ data: entries }, { data: disputes }, { data: evidence }, { data: events }] = await Promise.all([
      supabase.from("timesheet_entries").select("*").eq("card_id", card.id).order("work_date"),
      supabase.from("timesheet_disputes").select("*").eq("card_id", card.id).order("created_at", { ascending: false }),
      supabase
        .from("point_card_evidence")
        .select("*")
        .eq("card_id", card.id)
        .order("card_version", { ascending: false }),
      supabase
        .from("point_card_events")
        .select("*")
        .eq("card_id", card.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    return {
      card,
      entries: entries ?? [],
      disputes: disputes ?? [],
      evidence: evidence ?? [],
      events: events ?? [],
    };
  });

/** Corrige um lançamento diário antes do fechamento. */
export const updateTimesheetEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => entryPatchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { logCardEvent } = await import("./timesheet.server");

    const { data: entry } = await supabase
      .from("timesheet_entries")
      .select("id, card_id, company_id, work_date")
      .eq("id", data.entryId)
      .maybeSingle();
    if (!entry) return { error: "Lançamento não encontrado." };

    const { data: card } = await supabase
      .from("point_cards")
      .select("id, status")
      .eq("id", entry.card_id)
      .maybeSingle();
    if (!card) return { error: "Cartão não encontrado." };
    if (card.status === "assinado") {
      return { error: "Cartão assinado. Reabra o período para corrigir e gerar nova versão." };
    }

    const clockIn = data.clockIn ?? null;
    const clockOut = data.clockOut ?? null;
    const breakStart = data.breakStart ?? null;
    const breakEnd = data.breakEnd ?? null;
    const minutes = (a: string | null, b: string | null) =>
      a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : 0;
    const worked = minutes(clockIn, clockOut) - minutes(breakStart, breakEnd);

    await supabase
      .from("timesheet_entries")
      .update({
        clock_in: clockIn,
        break_start: breakStart,
        break_end: breakEnd,
        clock_out: clockOut,
        worked_minutes: Math.max(0, worked),
        notes: data.notes ?? null,
        justification: data.justification ?? null,
        source: "ajuste_manual",
      })
      .eq("id", entry.id);

    const { recalcCardTotals } = await import("./timesheet.server");
    await recalcCardTotals(supabase, entry.card_id);
    await logCardEvent(supabase, {
      company_id: entry.company_id,
      card_id: entry.card_id,
      actor_id: userId,
      event_type: "lancamento_corrigido",
      metadata: { work_date: entry.work_date },
    });

    return { ok: true };
  });

/** Publica cartões no Portal do Colaborador, com resultado individual. */
export const publishPointCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => publishSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { logCardEvent } = await import("./timesheet.server");

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) return { error: "Empresa não encontrada." };
    const companyId = profile.company_id;

    const { data: cards } = await supabase
      .from("point_cards")
      .select("id, unit_id, period_id, employee_id, status, version, summary, missing_punches")
      .in("id", data.cardIds);
    if (!cards?.length) return { error: "Nenhum cartão selecionado." };

    const startedAt = new Date().toISOString();
    const { data: batch } = await supabase
      .from("timesheet_batches")
      .insert({
        company_id: companyId,
        unit_id: cards[0]!.unit_id,
        period_id: cards[0]!.period_id,
        created_by: userId,
        status: "publicando",
        total_cards: cards.length,
        started_at: startedAt,
      })
      .select("id")
      .single();

    const results: { cardId: string; employeeId: string; status: string; message?: string }[] = [];
    let published = 0;
    let failed = 0;
    let skipped = 0;

    for (const card of cards) {
      if (card.status === "assinado") {
        skipped += 1;
        results.push({ cardId: card.id, employeeId: card.employee_id, status: "ja_assinado" });
        continue;
      }
      if (card.status === "publicado" || card.status === "em_validacao") {
        skipped += 1;
        results.push({ cardId: card.id, employeeId: card.employee_id, status: "ja_publicado" });
        continue;
      }

      const summary = (card.summary ?? {}) as { alerts?: string[] };
      const critical = (summary.alerts ?? []).includes("sem_dados") || (card.missing_punches ?? 0) > 0;
      if (critical && !data.force) {
        failed += 1;
        results.push({
          cardId: card.id,
          employeeId: card.employee_id,
          status: "erro",
          message: "Cartão com inconsistências. Revise ou confirme a publicação mesmo assim.",
        });
        continue;
      }

      const publishedAt = new Date().toISOString();
      const { error } = await supabase
        .from("point_cards")
        .update({
          status: "publicado",
          published_at: publishedAt,
          publish_error: null,
          batch_id: batch?.id ?? null,
        })
        .eq("id", card.id);

      if (error) {
        failed += 1;
        await supabase
          .from("point_cards")
          .update({ status: "erro_publicacao", publish_error: error.message })
          .eq("id", card.id);
        results.push({ cardId: card.id, employeeId: card.employee_id, status: "erro", message: error.message });
        continue;
      }

      published += 1;
      results.push({ cardId: card.id, employeeId: card.employee_id, status: "publicado" });
      await logCardEvent(supabase, {
        company_id: companyId,
        card_id: card.id,
        period_id: card.period_id,
        batch_id: batch?.id ?? null,
        actor_id: userId,
        actor_label: profile.full_name,
        event_type: "cartao_publicado",
        metadata: { version: card.version },
      });
    }

    const status =
      failed === 0 && published > 0
        ? "publicado"
        : published > 0
          ? "publicado_parcial"
          : failed > 0
            ? "com_erros"
            : "publicado";

    if (batch?.id) {
      await supabase
        .from("timesheet_batches")
        .update({
          status,
          published_cards: published,
          failed_cards: failed,
          skipped_cards: skipped,
          results: results as never,
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch.id);
    }

    return { ok: true, batchId: batch?.id ?? null, status, published, failed, skipped, results };
  });

/** Reabre um cartão assinado ou publicado, criando uma nova versão. */
export const reopenPointCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cardId: z.string().uuid(), reason: z.string().trim().min(5).max(600) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { logCardEvent } = await import("./timesheet.server");

    const { data: card } = await supabase
      .from("point_cards")
      .select("id, company_id, version, status")
      .eq("id", data.cardId)
      .maybeSingle();
    if (!card) return { error: "Cartão não encontrado." };
    if (card.status === "rascunho") return { error: "Este cartão ainda está em rascunho." };

    const nextVersion = (card.version ?? 1) + 1;
    await supabase
      .from("point_cards")
      .update({
        status: "reaberto",
        version: nextVersion,
        reopened_at: new Date().toISOString(),
        reopen_reason: data.reason,
        signed_at: null,
        acknowledged_at: null,
        viewed_at: null,
      })
      .eq("id", card.id);

    await logCardEvent(supabase, {
      company_id: card.company_id,
      card_id: card.id,
      actor_id: userId,
      event_type: "cartao_reaberto",
      metadata: { reason: data.reason, version: nextVersion },
    });

    return { ok: true, version: nextVersion };
  });

/** Responde ou resolve uma divergência apontada pelo colaborador. */
export const respondTimesheetDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        disputeId: z.string().uuid(),
        response: z.string().trim().min(3).max(1000),
        resolve: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { logCardEvent } = await import("./timesheet.server");

    const { data: dispute } = await supabase
      .from("timesheet_disputes")
      .select("id, card_id, company_id")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!dispute) return { error: "Divergência não encontrada." };

    await supabase
      .from("timesheet_disputes")
      .update({
        manager_response: data.response,
        status: data.resolve ? "resolvida" : "respondida",
        resolved_by: data.resolve ? userId : null,
        resolved_at: data.resolve ? new Date().toISOString() : null,
      })
      .eq("id", dispute.id);

    if (data.resolve) {
      await supabase
        .from("point_cards")
        .update({ status: "corrigido", viewed_at: null })
        .eq("id", dispute.card_id)
        .eq("status", "divergente");
    }

    await logCardEvent(supabase, {
      company_id: dispute.company_id,
      card_id: dispute.card_id,
      actor_id: userId,
      event_type: data.resolve ? "divergencia_resolvida" : "divergencia_respondida",
      metadata: { response: data.response },
    });

    return { ok: true };
  });

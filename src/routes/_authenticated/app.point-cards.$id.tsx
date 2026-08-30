import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Printer, RotateCcw, ShieldCheck } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import {
  getPointCard,
  publishPointCards,
  reopenPointCard,
  respondTimesheetDispute,
  updateTimesheetEntry,
} from "@/lib/timesheet.functions";
import {
  ALERT_LABEL,
  CARD_STATUS_LABEL,
  CARD_STATUS_TONE,
  DISPUTE_CATEGORY_LABEL,
  DISPUTE_STATUS_LABEL,
} from "@/lib/timesheet.shared";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dateFmt, dateTimeFmt, minutesToHours } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/point-cards/$id")({
  head: () => ({
    meta: [
      { title: `Cartão de ponto — ${BRAND_NAME}` },
      { name: "description", content: "Conferência, correção, divergências e comprovante do cartão de ponto." },
      { property: "og:title", content: `Cartão de ponto — ${BRAND_NAME}` },
      { property: "og:description", content: "Detalhe auditável do cartão de ponto do colaborador." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PointCardDetailPage,
});

const toLocal = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

function PointCardDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const fetchCard = useServerFn(getPointCard);
  const updateEntry = useServerFn(updateTimesheetEntry);
  const publishFn = useServerFn(publishPointCards);
  const reopenFn = useServerFn(reopenPointCard);
  const respondFn = useServerFn(respondTimesheetDispute);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ clockIn: "", breakStart: "", breakEnd: "", clockOut: "", justification: "" });
  const [reopenReason, setReopenReason] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["point-card", id],
    queryFn: () => fetchCard({ data: { cardId: id } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["point-card", id] });
    void queryClient.invalidateQueries({ queryKey: ["timesheet-period"] });
  };

  const saveEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await updateEntry({
        data: {
          entryId,
          clockIn: toIso(draft.clockIn),
          breakStart: toIso(draft.breakStart),
          breakEnd: toIso(draft.breakEnd),
          clockOut: toIso(draft.clockOut),
          justification: draft.justification.trim() || null,
        },
      });
      if ("error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Lançamento corrigido.");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao corrigir."),
  });

  const publish = useMutation({
    mutationFn: async (force: boolean) => {
      const res = await publishFn({ data: { cardIds: [id], force } });
      if ("error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      if ("failed" in res && res.failed > 0) {
        toast.warning(res.results[0]?.message ?? "Cartão com inconsistências.");
      } else {
        toast.success("Cartão publicado no Portal do Colaborador.");
      }
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao publicar."),
  });

  const reopen = useMutation({
    mutationFn: async () => {
      const res = await reopenFn({ data: { cardId: id, reason: reopenReason.trim() } });
      if ("error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Cartão reaberto em nova versão.");
      setReopenReason("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao reabrir."),
  });

  const respond = useMutation({
    mutationFn: async ({ disputeId, status }: { disputeId: string; status: "respondida" | "resolvida" }) => {
      const res = await respondFn({
        data: { disputeId, status, response: (answers[disputeId] ?? "").trim() },
      });
      if ("error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Resposta registrada.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao responder."),
  });

  if (query.isLoading) return <LoadingState rows={6} label="Carregando cartão…" />;
  if (query.isError || (query.data && "error" in query.data)) {
    return (
      <ErrorState
        title="Cartão indisponível"
        action={
          <Button asChild>
            <Link to="/app/point-cards">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const data = query.data && !("error" in query.data) ? query.data : null;
  const card = data?.card;
  if (!card) return <EmptyState title="Cartão não encontrado" />;

  const employee = (card as unknown as { employees?: { full_name?: string; employee_code?: string | null } })
    .employees;
  const entries = data?.entries ?? [];
  const disputes = data?.disputes ?? [];
  const evidence = data?.evidence ?? [];
  const events = data?.events ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${dateFmt(card.period_start)} — ${dateFmt(card.period_end)} · v${card.version ?? 1}`}
        title={employee?.full_name ?? "Cartão de ponto"}
        description="Conferência do período, correções auditáveis, divergências do colaborador e comprovante do aceite."
        actions={
          <>
            <Button asChild variant="ghost">
              <Link to="/app/point-cards">
                <ArrowLeft className="mr-2 size-4" /> Voltar
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="mr-2 size-4" /> Comprovante
            </Button>
            {card.status !== "assinado" ? (
              <Button onClick={() => publish.mutate(false)} disabled={publish.isPending}>
                Publicar
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={CARD_STATUS_TONE[card.status] ?? "neutral"}>
          {CARD_STATUS_LABEL[card.status] ?? card.status}
        </StatusBadge>
        {card.published_at ? <StatusBadge>Publicado em {dateTimeFmt(card.published_at)}</StatusBadge> : null}
        {card.viewed_at ? <StatusBadge>Visto em {dateTimeFmt(card.viewed_at)}</StatusBadge> : null}
        {card.signed_at ? (
          <StatusBadge tone="ok">Assinado em {dateTimeFmt(card.signed_at)}</StatusBadge>
        ) : null}
        {card.publish_error ? <StatusBadge tone="danger">{card.publish_error}</StatusBadge> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Planejado" value={minutesToHours(card.planned_minutes)} />
        <StatCard label="Trabalhado" value={minutesToHours(card.worked_minutes)} tone="success" />
        <StatCard label="Extras" value={minutesToHours(card.overtime_minutes)} tone="info" />
        <StatCard
          label="Saldo"
          value={minutesToHours(card.balance_minutes)}
          hint={`${card.absence_days ?? 0} falta(s) · ${card.missing_punches ?? 0} batida(s) faltante(s)`}
          tone="warning"
        />
      </div>

      <SectionCard title="Lançamentos diários">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <th className="py-2">Dia</th>
                <th className="py-2">Entrada</th>
                <th className="py-2">Intervalo</th>
                <th className="py-2">Saída</th>
                <th className="py-2">Trabalhado</th>
                <th className="py-2">Alertas</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isEditing = editing === e.id;
                return (
                  <tr key={e.id} className="border-b border-foreground/20 align-top">
                    <td className="py-2 font-semibold">{dateFmt(e.work_date)}</td>
                    {isEditing ? (
                      <>
                        <td className="py-2">
                          <Input
                            type="datetime-local"
                            value={draft.clockIn}
                            onChange={(ev) => setDraft({ ...draft, clockIn: ev.target.value })}
                          />
                        </td>
                        <td className="space-y-1 py-2">
                          <Input
                            type="datetime-local"
                            value={draft.breakStart}
                            onChange={(ev) => setDraft({ ...draft, breakStart: ev.target.value })}
                          />
                          <Input
                            type="datetime-local"
                            value={draft.breakEnd}
                            onChange={(ev) => setDraft({ ...draft, breakEnd: ev.target.value })}
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            type="datetime-local"
                            value={draft.clockOut}
                            onChange={(ev) => setDraft({ ...draft, clockOut: ev.target.value })}
                          />
                        </td>
                        <td className="py-2" colSpan={2}>
                          <Textarea
                            placeholder="Justificativa da correção"
                            value={draft.justification}
                            onChange={(ev) => setDraft({ ...draft, justification: ev.target.value })}
                          />
                        </td>
                        <td className="space-x-2 py-2 text-right">
                          <Button size="sm" onClick={() => saveEntry.mutate(e.id)} disabled={saveEntry.isPending}>
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Cancelar
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2">{e.clock_in ? dateTimeFmt(e.clock_in) : "—"}</td>
                        <td className="py-2">
                          {e.break_start || e.break_end
                            ? `${e.break_start ? dateTimeFmt(e.break_start) : "—"} → ${e.break_end ? dateTimeFmt(e.break_end) : "—"}`
                            : "—"}
                        </td>
                        <td className="py-2">{e.clock_out ? dateTimeFmt(e.clock_out) : "—"}</td>
                        <td className="py-2">{minutesToHours(e.worked_minutes)}</td>
                        <td className="py-2">
                          <span className="flex flex-wrap gap-1">
                            {(e.alerts ?? []).map((a: string) => (
                              <StatusBadge key={a} tone="warn">
                                {ALERT_LABEL[a] ?? a}
                              </StatusBadge>
                            ))}
                            {e.absence_status ? <StatusBadge>{e.absence_status}</StatusBadge> : null}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={card.status === "assinado"}
                            onClick={() => {
                              setEditing(e.id);
                              setDraft({
                                clockIn: toLocal(e.clock_in),
                                breakStart: toLocal(e.break_start),
                                breakEnd: toLocal(e.break_end),
                                clockOut: toLocal(e.clock_out),
                                justification: e.justification ?? "",
                              });
                            }}
                          >
                            Corrigir
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Divergências do colaborador">
        {disputes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma divergência registrada neste cartão.</p>
        ) : (
          <ul className="space-y-3">
            {disputes.map((d) => (
              <li key={d.id} className="rounded-[12px] border-2 border-foreground p-4 shadow-[4px_4px_0_var(--ink)]">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={d.status === "resolvida" ? "ok" : "warn"}>
                    {DISPUTE_STATUS_LABEL[d.status] ?? d.status}
                  </StatusBadge>
                  <StatusBadge>{DISPUTE_CATEGORY_LABEL[d.category] ?? d.category}</StatusBadge>
                  {d.work_date ? <StatusBadge>{dateFmt(d.work_date)}</StatusBadge> : null}
                  <span className="text-xs text-muted-foreground">{dateTimeFmt(d.created_at)}</span>
                </div>
                <p className="mt-2 text-sm">{d.description}</p>
                {d.response ? (
                  <p className="mt-2 rounded-[8px] border-2 border-foreground bg-secondary p-2 text-sm">
                    Resposta: {d.response}
                  </p>
                ) : null}
                {d.status !== "resolvida" ? (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor={`resp-${d.id}`}>Resposta da gestão</Label>
                    <Textarea
                      id={`resp-${d.id}`}
                      value={answers[d.id] ?? ""}
                      onChange={(ev) => setAnswers({ ...answers, [d.id]: ev.target.value })}
                      placeholder="Explique a análise e o que foi ajustado."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => respond.mutate({ disputeId: d.id, status: "respondida" })}
                        disabled={respond.isPending}
                      >
                        Responder
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => respond.mutate({ disputeId: d.id, status: "resolvida" })}
                        disabled={respond.isPending}
                      >
                        Resolver
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Comprovante e evidências">
          {evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma evidência registrada até o momento.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {evidence.map((ev) => (
                <li key={ev.id} className="rounded-[12px] border-2 border-foreground p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4" aria-hidden />
                    <span className="font-bold">Versão {ev.card_version}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Identidade</dt>
                      <dd>{ev.face_status ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Prova de vida</dt>
                      <dd>{ev.liveness_status ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Localização</dt>
                      <dd>
                        {ev.location_status ?? "—"}
                        {ev.latitude != null ? ` (${ev.latitude.toFixed(5)}, ${ev.longitude?.toFixed(5)})` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Assinado em</dt>
                      <dd>{ev.signed_at ? dateTimeFmt(ev.signed_at) : "—"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Hash de integridade</dt>
                      <dd className="break-all font-mono text-[11px]">{ev.integrity_hash ?? "—"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Trilha de auditoria">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-start justify-between gap-3 border-b border-foreground/20 pb-2">
                  <span>
                    <span className="font-semibold">{ev.event_type}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ev.actor_label ?? ev.actor_type} · {dateTimeFmt(ev.created_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Reabrir período">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="reopen">Motivo da reabertura</Label>
            <Textarea
              id="reopen"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Descreva o motivo. O cartão volta ao colaborador em nova versão."
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => reopen.mutate()}
            disabled={reopen.isPending || reopenReason.trim().length < 5}
          >
            <RotateCcw className="mr-2 size-4" /> Reabrir
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

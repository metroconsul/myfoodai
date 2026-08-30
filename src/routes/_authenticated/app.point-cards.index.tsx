import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CalendarCheck, FileSignature, Send, Users } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import { useWorkspace } from "@/hooks/use-workspace";
import { listTimesheetPeriod, prepareTimesheetCards, publishPointCards } from "@/lib/timesheet.functions";
import {
  CARD_STATUS_LABEL,
  CARD_STATUS_TONE,
  monthLabel,
  monthRange,
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
import { Checkbox } from "@/components/ui/checkbox";
import { minutesToHours } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/point-cards/")({
  head: () => ({
    meta: [
      { title: `Cartões de ponto — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Feche o período, revise as horas e publique os cartões de ponto para assinatura eletrônica.",
      },
      { property: "og:title", content: `Cartões de ponto — ${BRAND_NAME}` },
      { property: "og:description", content: "Fechamento, publicação em lote e assinatura de cartões de ponto." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PointCardsPage,
});

function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function PointCardsPage() {
  const { activeUnitId, activeUnit } = useWorkspace();
  const queryClient = useQueryClient();

  const loadPeriod = useServerFn(listTimesheetPeriod);
  const prepareFn = useServerFn(prepareTimesheetCards);
  const publishFn = useServerFn(publishPointCards);

  const [month, setMonth] = useState(currentMonth());
  const [deadline, setDeadline] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const range = useMemo(() => monthRange(month), [month]);

  const query = useQuery({
    queryKey: ["timesheet-period", activeUnitId, range.start, range.end],
    enabled: !!activeUnitId,
    queryFn: () =>
      loadPeriod({ data: { unitId: activeUnitId!, periodStart: range.start, periodEnd: range.end } }),
  });

  const employees = query.data?.employees ?? [];
  const cards = query.data?.cards ?? [];
  const disputes = query.data?.disputes ?? [];

  const cardByEmployee = useMemo(() => {
    const map = new Map<string, (typeof cards)[number]>();
    for (const c of cards) map.set(c.employee_id, c);
    return map;
  }, [cards]);

  const disputesByCard = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of disputes) if (d.status !== "resolvida") map.set(d.card_id, (map.get(d.card_id) ?? 0) + 1);
    return map;
  }, [disputes]);

  const prepare = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      if (!employeeIds.length) throw new Error("Selecione ao menos um colaborador.");
      const res = await prepareFn({
        data: {
          unitId: activeUnitId!,
          periodStart: range.start,
          periodEnd: range.end,
          employeeIds,
          deadlineAt: deadline ? new Date(deadline).toISOString() : null,
          timezone: "America/Sao_Paulo",
        },
      });
      if ("error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      const skipped = "skipped" in res ? res.skipped.length : 0;
      toast.success(
        `${"created" in res ? res.created : 0} cartão(ões) preparado(s).${skipped ? ` ${skipped} ignorado(s).` : ""}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["timesheet-period"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível preparar."),
  });

  const publish = useMutation({
    mutationFn: async ({ cardIds, force }: { cardIds: string[]; force: boolean }) => {
      if (!cardIds.length) throw new Error("Selecione cartões para publicar.");
      const res = await publishFn({ data: { cardIds, force } });
      if ("error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      if ("published" in res) {
        if (res.failed > 0) {
          toast.warning(
            `${res.published} publicado(s), ${res.failed} com inconsistências. Revise ou publique mesmo assim.`,
          );
        } else {
          toast.success(`${res.published} cartão(ões) publicado(s). ${res.skipped} ignorado(s).`);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["timesheet-period"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível publicar."),
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectedCardIds = selected.map((id) => cardByEmployee.get(id)?.id).filter(Boolean) as string[];

  const totals = useMemo(
    () => ({
      prepared: cards.length,
      published: cards.filter((c) => ["publicado", "em_validacao"].includes(c.status)).length,
      signed: cards.filter((c) => c.status === "assinado").length,
      disputed: cards.filter((c) => c.status === "divergente").length,
    }),
    [cards],
  );

  if (!activeUnitId) {
    return <EmptyState title="Selecione uma unidade" description="Escolha a unidade no topo do painel." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ponto"
        title="Cartões de ponto"
        description="Feche o período, confira as horas de cada colaborador e publique os cartões para conferência e assinatura eletrônica no Portal."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => prepare.mutate(employees.map((e) => e.id))}
              disabled={prepare.isPending || !employees.length}
            >
              <CalendarCheck className="mr-2 size-4" /> Preparar todos
            </Button>
            <Button
              onClick={() => publish.mutate({ cardIds: selectedCardIds, force: false })}
              disabled={publish.isPending || !selectedCardIds.length}
            >
              <Send className="mr-2 size-4" /> Publicar selecionados
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cartões preparados" value={totals.prepared} icon={<Users className="size-5" />} />
        <StatCard label="Aguardando assinatura" value={totals.published} tone="warning" />
        <StatCard label="Assinados" value={totals.signed} tone="success" icon={<FileSignature className="size-5" />} />
        <StatCard label="Com divergência" value={totals.disputed} tone="danger" />
      </div>

      <SectionCard title="Período de fechamento">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="month">Mês de referência</Label>
            <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">{monthLabel(range.start)}</p>
          </div>
          <div>
            <Label htmlFor="deadline">Prazo para conferência</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => prepare.mutate(selected)}
              disabled={prepare.isPending || !selected.length}
            >
              Preparar selecionados
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={`Colaboradores da unidade ${activeUnit?.name ?? ""}`}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(employees.map((e) => e.id))}>
              Selecionar todos
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Limpar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => publish.mutate({ cardIds: selectedCardIds, force: true })}
              disabled={publish.isPending || !selectedCardIds.length}
            >
              Publicar mesmo assim
            </Button>
          </div>
        }
      >
        {query.isLoading ? (
          <LoadingState rows={6} label="Carregando período…" />
        ) : query.isError ? (
          <ErrorState action={<Button onClick={() => void query.refetch()}>Tentar novamente</Button>} />
        ) : employees.length === 0 ? (
          <EmptyState
            title="Nenhum colaborador nesta unidade"
            description="Cadastre a equipe para gerar cartões de ponto."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b-2 border-foreground text-left">
                  <th className="w-10 py-2" />
                  <th className="py-2">Colaborador</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Planejado</th>
                  <th className="py-2">Trabalhado</th>
                  <th className="py-2">Saldo</th>
                  <th className="py-2">Pendências</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const card = cardByEmployee.get(emp.id);
                  const open = card ? (disputesByCard.get(card.id) ?? 0) : 0;
                  return (
                    <tr key={emp.id} className="border-b border-foreground/20">
                      <td className="py-2">
                        <Checkbox
                          checked={selected.includes(emp.id)}
                          onCheckedChange={() => toggle(emp.id)}
                          aria-label={`Selecionar ${emp.full_name}`}
                        />
                      </td>
                      <td className="py-2 font-semibold">
                        {emp.full_name}
                        <span className="block text-xs text-muted-foreground">
                          {emp.employee_code ?? "—"}
                        </span>
                      </td>
                      <td className="py-2">
                        {card ? (
                          <StatusBadge tone={CARD_STATUS_TONE[card.status] ?? "neutral"}>
                            {CARD_STATUS_LABEL[card.status] ?? card.status} · v{card.version ?? 1}
                          </StatusBadge>
                        ) : (
                          <StatusBadge>Sem cartão</StatusBadge>
                        )}
                      </td>
                      <td className="py-2">{card ? minutesToHours(card.planned_minutes) : "—"}</td>
                      <td className="py-2">{card ? minutesToHours(card.worked_minutes) : "—"}</td>
                      <td className="py-2">{card ? minutesToHours(card.balance_minutes) : "—"}</td>
                      <td className="py-2">
                        <span className="flex flex-wrap gap-1">
                          {card && (card.missing_punches ?? 0) > 0 ? (
                            <StatusBadge tone="warn">{card.missing_punches} batida(s)</StatusBadge>
                          ) : null}
                          {open > 0 ? <StatusBadge tone="danger">{open} divergência(s)</StatusBadge> : null}
                          {card?.publish_error ? <StatusBadge tone="danger">Erro</StatusBadge> : null}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {card ? (
                          <Button asChild size="sm" variant="secondary">
                            <Link to="/app/point-cards/$id" params={{ id: card.id }}>
                              Abrir
                            </Link>
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => prepare.mutate([emp.id])}>
                            Preparar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

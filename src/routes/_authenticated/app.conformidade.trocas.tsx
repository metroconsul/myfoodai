import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { useWorkspace } from "@/hooks/use-workspace";
import { BRAND_NAME } from "@/config/brand";
import { PageHeader, SectionCard, EmptyState, LoadingState, ErrorState, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateTimeFmt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/conformidade/trocas")({
  head: () => ({
    meta: [
      { title: `Trocas e devoluções — ${BRAND_NAME}` },
      { name: "description", content: "Analise solicitações de troca, devolução e reposição de uniformes e itens." },
      { property: "og:title", content: `Trocas e devoluções — ${BRAND_NAME}` },
      { property: "og:description", content: "Fila de trocas e devoluções da equipe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExchangesPage,
});

const STATUSES = [
  "solicitada",
  "em_analise",
  "aprovada",
  "aguardando_devolucao",
  "entregue",
  "recusada",
  "cancelada",
  "concluida",
] as const;

const STATUS_LABEL: Record<string, string> = {
  solicitada: "Solicitada",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  aguardando_devolucao: "Aguardando devolução",
  entregue: "Entregue",
  recusada: "Recusada",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "neutral" | "info"> = {
  solicitada: "warn",
  em_analise: "info",
  aprovada: "info",
  aguardando_devolucao: "warn",
  entregue: "ok",
  recusada: "danger",
  cancelada: "neutral",
  concluida: "ok",
};

const OPEN_STATUSES = ["solicitada", "em_analise", "aprovada", "aguardando_devolucao"];

function ExchangesPage() {
  const { units, activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("abertas");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["uniform-exchanges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uniform_exchange_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const employeeIds = [...new Set((data ?? []).map((r) => r.employee_id))];
      const itemIds = [...new Set((data ?? []).map((r) => r.item_id).filter(Boolean) as string[])];
      const [{ data: employees }, { data: items }] = await Promise.all([
        employeeIds.length
          ? supabase.from("employees").select("id, full_name").in("id", employeeIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
        itemIds.length
          ? supabase.from("catalog_items").select("id, name").in("id", itemIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      return { requests: data ?? [], employees: employees ?? [], items: items ?? [] };
    },
  });

  const employeeMap = useMemo(
    () => new Map((query.data?.employees ?? []).map((e) => [e.id, e.full_name])),
    [query.data],
  );
  const itemMap = useMemo(() => new Map((query.data?.items ?? []).map((i) => [i.id, i.name])), [query.data]);
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Enums<"uniform_exchange_status"> }) => {
      const { data: session } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("uniform_exchange_requests")
        .update({
          status,
          review_notes: notes[id] ?? null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada.");
      queryClient.invalidateQueries({ queryKey: ["uniform-exchanges"] });
    },
    onError: () => toast.error("Não foi possível atualizar a solicitação."),
  });

  if (query.isLoading) return <LoadingState rows={4} label="Carregando solicitações…" />;
  if (query.isError)
    return <ErrorState action={<Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button>} />;

  const rows = (query.data?.requests ?? []).filter((r) => {
    if (activeUnitId && r.unit_id && r.unit_id !== activeUnitId) return false;
    if (filter === "todas") return true;
    if (filter === "abertas") return OPEN_STATUSES.includes(r.status);
    return r.status === filter;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Uniformes e itens"
        title="Trocas e devoluções"
        description="Analise pedidos de troca por tamanho, desgaste, dano ou devolução no desligamento."
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56" aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abertas">Somente abertas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma solicitação"
          description="As solicitações enviadas pelo Portal do Colaborador aparecem aqui."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((request) => (
            <SectionCard
              key={request.id}
              title={employeeMap.get(request.employee_id) ?? "Colaborador"}
              action={
                <StatusBadge tone={STATUS_TONE[request.status] ?? "neutral"}>
                  {STATUS_LABEL[request.status] ?? request.status}
                </StatusBadge>
              }
            >
              <p className="meta-mono mb-2">
                {request.item_id ? itemMap.get(request.item_id) ?? "Item" : "Item não informado"} ·{" "}
                {request.unit_id ? unitMap.get(request.unit_id) ?? "Unidade" : "Sem unidade"} ·{" "}
                {dateTimeFmt(request.created_at)}
              </p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="meta-mono">Motivo</dt><dd>{request.reason}</dd></div>
                <div><dt className="meta-mono">Tamanho / cor pedidos</dt><dd>{request.requested_size ?? "—"} · {request.requested_color ?? "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="meta-mono">Descrição</dt><dd>{request.description ?? "—"}</dd></div>
                {request.returned_condition ? (
                  <div className="sm:col-span-2"><dt className="meta-mono">Condição na devolução</dt><dd>{request.returned_condition}</dd></div>
                ) : null}
                {request.reviewed_at ? (
                  <div className="sm:col-span-2">
                    <dt className="meta-mono">Análise</dt>
                    <dd>{request.review_notes ?? "Sem observação"} · {dateTimeFmt(request.reviewed_at)}</dd>
                  </div>
                ) : null}
              </dl>

              {OPEN_STATUSES.includes(request.status) ? (
                <div className="mt-4 space-y-2">
                  <Label htmlFor={`note-${request.id}`}>Observação da análise</Label>
                  <Textarea
                    id={`note-${request.id}`}
                    maxLength={600}
                    value={notes[request.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: request.id, status: "aprovada" })}>
                      Aprovar
                    </Button>
                    <Button size="sm" variant="secondary" disabled={review.isPending} onClick={() => review.mutate({ id: request.id, status: "aguardando_devolucao" })}>
                      Aguardar devolução
                    </Button>
                    <Button size="sm" variant="secondary" disabled={review.isPending} onClick={() => review.mutate({ id: request.id, status: "entregue" })}>
                      Marcar entregue
                    </Button>
                    <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: request.id, status: "recusada" })}>
                      Recusar
                    </Button>
                    <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: request.id, status: "concluida" })}>
                      Concluir
                    </Button>
                  </div>
                </div>
              ) : null}
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}

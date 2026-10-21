import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  PackageCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { EmptyState, LoadingState, PageHeader, StatCard, StatusBadge } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { dateFmt, dateTimeFmt, isoDate } from "@/lib/format";
import { effectiveDocumentStatus } from "@/lib/compliance.shared";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: `Operação hoje — ${BRAND_NAME}` },
      { name: "description", content: "Pendências de colaboradores, ponto, documentos e EPIs que precisam de atenção." },
      { property: "og:title", content: `Operação hoje — ${BRAND_NAME}` },
      { property: "og:description", content: "Painel operacional diário." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type ActionItem = {
  id: string;
  kind: "Ponto" | "Documento" | "EPI";
  title: string;
  description: string;
  critical: boolean;
  to: "/app/time-entries" | "/app/conformidade/exames" | "/app/deliveries";
};

function Dashboard() {
  const { activeUnitId, activeUnit } = useWorkspace();
  const today = isoDate(new Date());

  const query = useQuery({
    queryKey: ["mvp-dashboard", activeUnitId, today],
    enabled: Boolean(activeUnitId),
    queryFn: async () => {
      const unitId = activeUnitId!;
      const dayStart = new Date(`${today}T00:00:00`);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [employees, entries, reviews, documents, requests, deliveries] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("employment_status", "ativo"),
        supabase.from("time_entries").select("id, geo_status, validation_status").eq("unit_id", unitId).gte("server_time", dayStart.toISOString()).lt("server_time", dayEnd.toISOString()),
        supabase.from("time_entry_reviews").select("id, reason, requested_time, created_at, employees(full_name)").eq("unit_id", unitId).eq("status", "pendente").order("created_at", { ascending: false }).limit(20),
        supabase.from("occupational_documents").select("id, title, status, expires_at, employees(full_name)").eq("unit_id", unitId).is("archived_at", null).order("expires_at", { ascending: true, nullsFirst: false }),
        supabase.from("document_requests").select("id, due_at, message, employees(full_name)").eq("unit_id", unitId).eq("status", "aberta").order("due_at", { ascending: true, nullsFirst: false }),
        supabase.from("item_deliveries").select("id, status, delivered_at, expires_at, employees(full_name)").eq("unit_id", unitId).in("status", ["aguardando_aceite", "em_validacao", "recusado", "divergente"]).order("delivered_at", { ascending: false }),
      ]);

      const firstError = [employees, entries, reviews, documents, requests, deliveries].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const pendingDocuments = (documents.data ?? []).filter((document) => {
        const status = effectiveDocumentStatus(document.status, document.expires_at);
        return ["vencido", "vence_em_breve", "aguardando_documento", "em_revisao"].includes(status);
      });
      const pointAnomalies = (entries.data ?? []).filter(
        (entry) => entry.geo_status !== "dentro_do_raio" || !["valido", "aprovado"].includes(entry.validation_status),
      );

      const actions: ActionItem[] = [
        ...(reviews.data ?? []).map((review): ActionItem => ({
          id: `review:${review.id}`,
          kind: "Ponto",
          title: `${review.employees?.full_name ?? "Colaborador"} — correção de ponto`,
          description: review.reason || (review.requested_time ? dateTimeFmt(review.requested_time) : "Aguardando revisão"),
          critical: true,
          to: "/app/time-entries",
        })),
        ...pendingDocuments.map((document): ActionItem => {
          const status = effectiveDocumentStatus(document.status, document.expires_at);
          return {
            id: `document:${document.id}`,
            kind: "Documento",
            title: `${document.employees?.full_name ?? "Colaborador"} — ${document.title}`,
            description: document.expires_at
              ? `${status === "vencido" ? "Vencido" : "Vence"} em ${dateFmt(document.expires_at)}`
              : "Documento aguardando regularização",
            critical: status === "vencido",
            to: "/app/conformidade/exames",
          };
        }),
        ...(requests.data ?? []).map((request): ActionItem => ({
          id: `request:${request.id}`,
          kind: "Documento",
          title: `${request.employees?.full_name ?? "Colaborador"} — solicitação aberta`,
          description: request.due_at ? `Prazo ${dateFmt(request.due_at)}` : request.message || "Aguardando envio",
          critical: Boolean(request.due_at && new Date(`${request.due_at}T23:59:59`) < new Date()),
          to: "/app/conformidade/exames",
        })),
        ...(deliveries.data ?? []).map((delivery): ActionItem => ({
          id: `delivery:${delivery.id}`,
          kind: "EPI",
          title: `${delivery.employees?.full_name ?? "Colaborador"} — EPI pendente`,
          description: delivery.status === "recusado" || delivery.status === "divergente" ? "Aceite com divergência" : "Aguardando aceite do colaborador",
          critical: delivery.status === "recusado" || delivery.status === "divergente",
          to: "/app/deliveries",
        })),
      ].sort((a, b) => Number(b.critical) - Number(a.critical));

      return {
        activeEmployees: employees.count ?? 0,
        pointCount: entries.data?.length ?? 0,
        pointDivergences: (reviews.data?.length ?? 0) + pointAnomalies.length,
        pendingDocuments: pendingDocuments.length + (requests.data?.length ?? 0),
        pendingEpis: deliveries.data?.length ?? 0,
        actions,
      };
    },
  });

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Operação hoje"
        title={activeUnit?.name ?? "Sua operação"}
        description="Veja primeiro o que precisa de uma decisão sua. O restante da operação continua trabalhando em segundo plano."
      />

      <section aria-label="Indicadores de hoje" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Colaboradores ativos" value={query.data?.activeEmployees ?? "—"} icon={<Users className="size-5" />} />
        <StatCard label="Pontos hoje" value={query.data?.pointCount ?? "—"} icon={<Clock className="size-5" />} />
        <StatCard label="Divergências" value={query.data?.pointDivergences ?? "—"} tone={(query.data?.pointDivergences ?? 0) > 0 ? "warning" : "success"} icon={<AlertTriangle className="size-5" />} />
        <StatCard label="Documentos pendentes" value={query.data?.pendingDocuments ?? "—"} tone={(query.data?.pendingDocuments ?? 0) > 0 ? "warning" : "success"} icon={<FileText className="size-5" />} />
        <StatCard label="EPIs pendentes" value={query.data?.pendingEpis ?? "—"} tone={(query.data?.pendingEpis ?? 0) > 0 ? "warning" : "success"} icon={<PackageCheck className="size-5" />} />
      </section>

      <section className="rounded-[16px] border-2 border-foreground bg-card shadow-[6px_6px_0_var(--ink)]" aria-labelledby="needs-you-title">
        <div className="border-b-2 border-foreground bg-accent px-5 py-5 sm:px-6">
          <p className="meta-mono text-foreground/70">Prioridade do gestor</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <h2 id="needs-you-title" className="display-type text-2xl sm:text-3xl">O que precisa de você</h2>
            {query.data ? <StatusBadge tone={query.data.actions.length > 0 ? "warn" : "ok"}>{query.data.actions.length} pendência(s)</StatusBadge> : null}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {query.isLoading ? (
            <LoadingState rows={4} label="Reunindo pendências…" />
          ) : query.isError ? (
            <EmptyState title="Não foi possível carregar as pendências" description="Atualize a página para tentar novamente." />
          ) : (query.data?.actions.length ?? 0) === 0 ? (
            <div className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center">
              <span className="grid size-12 shrink-0 place-items-center rounded-[12px] border-2 border-foreground bg-success"><CheckCircle2 className="size-6" aria-hidden /></span>
              <div>
                <p className="display-type text-lg">Tudo em dia por aqui</p>
                <p className="mt-1 text-sm text-muted-foreground">Nenhuma decisão operacional está aguardando você.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y-2 divide-foreground">
              {query.data!.actions.slice(0, 12).map((item) => (
                <li key={item.id}>
                  <Link to={item.to} className="group flex min-h-20 items-center gap-3 py-4 transition-transform active:translate-y-px">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-[10px] border-2 border-foreground ${item.critical ? "bg-destructive" : "bg-warning"}`}>
                      {item.kind === "Ponto" ? <Clock className="size-5" /> : item.kind === "Documento" ? <FileText className="size-5" /> : <PackageCheck className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{item.kind}</span>
                      <span className="mt-0.5 block font-semibold">{item.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{item.description}</span>
                    </span>
                    <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

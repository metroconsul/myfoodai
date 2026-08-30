import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardCheck, FileWarning, PackageCheck, Repeat, ShieldCheck, Shirt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { BRAND_NAME } from "@/config/brand";
import { PageHeader, SectionCard, StatCard, EmptyState, LoadingState, ErrorState, StatusBadge } from "@/components/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateFmt, dateTimeFmt } from "@/lib/format";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_STATUS_TONE,
  DOCUMENT_TYPE_LABEL,
  daysUntil,
  effectiveDocumentStatus,
} from "@/lib/compliance.shared";

export const Route = createFileRoute("/_authenticated/app/conformidade/")({
  head: () => ({
    meta: [
      { title: `Conformidade e equipe — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Acompanhe documentos, uniformes e pendências da sua operação em um só painel.",
      },
      { property: "og:title", content: `Conformidade e equipe — ${BRAND_NAME}` },
      { property: "og:description", content: "Documentos, uniformes e pendências da equipe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompliancePage,
});

function CompliancePage() {
  const { units, activeUnitId } = useWorkspace();
  const [unitFilter, setUnitFilter] = useState<string>("todas");
  const [windowDays, setWindowDays] = useState("30");

  const unitId = unitFilter === "todas" ? null : unitFilter;

  const query = useQuery({
    queryKey: ["compliance-overview", unitId],
    queryFn: async () => {
      const docs = supabase
        .from("occupational_documents")
        .select("id, employee_id, unit_id, document_type, title, status, expires_at, updated_at, published_to_portal_at")
        .is("archived_at", null);
      const deliveries = supabase
        .from("item_deliveries")
        .select("id, unit_id, status, delivered_at")
        .in("status", ["aguardando_aceite", "em_validacao"]);
      const exchanges = supabase
        .from("uniform_exchange_requests")
        .select("id, unit_id, status, reason, created_at")
        .in("status", ["solicitada", "em_analise", "aprovada", "aguardando_devolucao"]);
      const kits = supabase.from("uniform_kits").select("id, unit_id, name, required, active");

      const [d, dl, ex, k] = await Promise.all([
        unitId ? docs.eq("unit_id", unitId) : docs,
        unitId ? deliveries.eq("unit_id", unitId) : deliveries,
        unitId ? exchanges.eq("unit_id", unitId) : exchanges,
        unitId ? kits.eq("unit_id", unitId) : kits,
      ]);
      if (d.error) throw d.error;
      return {
        documents: d.data ?? [],
        deliveries: dl.data ?? [],
        exchanges: ex.data ?? [],
        kits: k.data ?? [],
      };
    },
  });

  const summary = useMemo(() => {
    const win = Number(windowDays);
    const docs = (query.data?.documents ?? []).map((doc) => ({
      ...doc,
      effective: effectiveDocumentStatus(doc.status, doc.expires_at, win),
    }));
    return {
      docs,
      regular: docs.filter((d) => d.effective === "regular").length,
      soon: docs.filter((d) => d.effective === "vence_em_breve").length,
      overdue: docs.filter((d) => d.effective === "vencido" || d.effective === "aguardando_documento").length,
      deliveries: query.data?.deliveries.length ?? 0,
      exchanges: query.data?.exchanges.length ?? 0,
      kits: query.data?.kits.filter((k) => k.required && k.active).length ?? 0,
    };
  }, [query.data, windowDays]);

  const recent = useMemo(() => {
    const events = [
      ...(query.data?.documents ?? []).map((d) => ({
        id: `doc-${d.id}`,
        label: `${DOCUMENT_TYPE_LABEL[d.document_type] ?? "Documento"} — ${d.title}`,
        kind: "Documento",
        at: d.updated_at,
      })),
      ...(query.data?.deliveries ?? []).map((d) => ({
        id: `del-${d.id}`,
        label: "Entrega aguardando aceite do colaborador",
        kind: "Entrega",
        at: d.delivered_at,
      })),
      ...(query.data?.exchanges ?? []).map((e) => ({
        id: `exc-${e.id}`,
        label: `Solicitação de troca (${e.reason})`,
        kind: "Troca",
        at: e.created_at,
      })),
    ];
    return events.sort((a, b) => (a.at > b.at ? -1 : 1)).slice(0, 12);
  }, [query.data]);

  if (query.isLoading) return <LoadingState rows={5} label="Carregando conformidade…" />;
  if (query.isError) return <ErrorState action={<button className="btn-brut" onClick={() => query.refetch()}>Tentar novamente</button>} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conformidade e equipe"
        title="Conformidade e equipe"
        description="Acompanhe documentos, uniformes e pendências da sua operação."
      />

      <div className="flex flex-wrap gap-3">
        <div className="min-w-48">
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger aria-label="Filtrar por unidade">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-44">
          <Select value={windowDays} onValueChange={setWindowDays}>
            <SelectTrigger aria-label="Janela de vencimento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[7, 30, 60, 90].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Próximos {d} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/app/conformidade/exames" search={{ status: "regular" }}>
          <StatCard label="Documentos regulares" value={summary.regular} icon={<ShieldCheck className="size-5" />} tone="success" />
        </Link>
        <Link to="/app/conformidade/exames" search={{ status: "vence_em_breve" }}>
          <StatCard label={`Vencendo em ${windowDays} dias`} value={summary.soon} icon={<FileWarning className="size-5" />} tone="warning" />
        </Link>
        <Link to="/app/conformidade/exames" search={{ status: "vencido" }}>
          <StatCard label="Vencidos ou pendentes" value={summary.overdue} icon={<FileWarning className="size-5" />} tone="danger" />
        </Link>
        <Link to="/app/conformidade/kits">
          <StatCard label="Kits obrigatórios ativos" value={summary.kits} icon={<Shirt className="size-5" />} />
        </Link>
        <Link to="/app/deliveries">
          <StatCard label="Entregas aguardando aceite" value={summary.deliveries} icon={<PackageCheck className="size-5" />} tone="info" />
        </Link>
        <Link to="/app/conformidade/trocas">
          <StatCard label="Trocas e devoluções abertas" value={summary.exchanges} icon={<Repeat className="size-5" />} />
        </Link>
      </div>

      <SectionCard title="Ações prioritárias">
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            { to: "/app/conformidade/exames", label: "Revisar documentos vencendo", search: { status: "vence_em_breve" } },
            { to: "/app/conformidade/exames", label: "Resolver documentos pendentes", search: { status: "aguardando_documento" } },
            { to: "/app/deliveries", label: "Entregar uniformes pendentes" },
            { to: "/app/conformidade/trocas", label: "Processar trocas e devoluções" },
            { to: "/app/conformidade/pendencias", label: "Ver pendências da equipe" },
          ].map((action) => (
            <li key={action.label}>
              <Link
                to={action.to}
                search={action.search as never}
                className="flex items-center gap-3 rounded-[10px] border-2 border-foreground bg-card px-4 py-3 text-sm font-semibold shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-y-0.5"
              >
                <ClipboardCheck className="size-4" aria-hidden />
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Atividade recente">
        {recent.length === 0 ? (
          <EmptyState title="Sem movimentações recentes" description="Documentos, entregas e trocas aparecem aqui." />
        ) : (
          <ul className="divide-y-2 divide-foreground/10">
            {recent.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{event.label}</p>
                  <p className="meta-mono">{dateTimeFmt(event.at)}</p>
                </div>
                <StatusBadge tone="neutral">{event.kind}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Documentos com prazo próximo">
        {summary.docs.filter((d) => d.effective === "vence_em_breve" || d.effective === "vencido").length === 0 ? (
          <EmptyState title="Nenhum prazo crítico" description="Nenhum documento vencido ou vencendo na janela selecionada." />
        ) : (
          <ul className="space-y-2">
            {summary.docs
              .filter((d) => d.effective === "vence_em_breve" || d.effective === "vencido")
              .slice(0, 10)
              .map((doc) => {
                const days = daysUntil(doc.expires_at);
                return (
                  <li key={doc.id}>
                    <Link
                      to="/app/conformidade/exames/$id"
                      params={{ id: doc.id }}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-foreground bg-card px-4 py-3 shadow-[3px_3px_0_var(--ink)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{doc.title}</p>
                        <p className="meta-mono">
                          {DOCUMENT_TYPE_LABEL[doc.document_type]} · prazo {dateFmt(doc.expires_at)}
                          {days != null ? ` · ${days < 0 ? `${Math.abs(days)} dias em atraso` : `faltam ${days} dias`}` : ""}
                        </p>
                      </div>
                      <StatusBadge tone={DOCUMENT_STATUS_TONE[doc.effective]}>
                        {DOCUMENT_STATUS_LABEL[doc.effective]}
                      </StatusBadge>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </SectionCard>

      <p className="text-xs text-muted-foreground">
        O painel exibe apenas status administrativos. Conteúdo clínico de exames não é apresentado em cards, listas
        ou exportações gerais.
      </p>
    </div>
  );
}

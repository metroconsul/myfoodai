import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { BRAND_NAME } from "@/config/brand";
import { PageHeader, SectionCard, EmptyState, LoadingState, ErrorState, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateFmt } from "@/lib/format";
import { DOCUMENT_TYPE_LABEL, daysUntil, effectiveDocumentStatus } from "@/lib/compliance.shared";

export const Route = createFileRoute("/_authenticated/app/conformidade/pendencias")({
  head: () => ({
    meta: [
      { title: `Pendências da equipe — ${BRAND_NAME}` },
      { name: "description", content: "Visão por colaborador de documentos, itens e cartões de ponto pendentes." },
      { property: "og:title", content: `Pendências da equipe — ${BRAND_NAME}` },
      { property: "og:description", content: "Pendências consolidadas por colaborador." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPendenciesPage,
});

type Pendency = { kind: string; label: string; due?: string | null; critical: boolean };

function TeamPendenciesPage() {
  const { units, activeUnitId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("todas");

  const query = useQuery({
    queryKey: ["team-pendencies"],
    queryFn: async () => {
      const [employees, documents, requests, deliveries, cards, exchanges] = await Promise.all([
        supabase.from("employees").select("id, full_name, unit_id, employment_status").eq("employment_status", "ativo"),
        supabase
          .from("occupational_documents")
          .select("id, employee_id, title, document_type, status, expires_at")
          .is("archived_at", null),
        supabase.from("document_requests").select("id, employee_id, document_type, due_at").eq("status", "aberta"),
        supabase
          .from("item_deliveries")
          .select("id, employee_id, delivered_at, expires_at")
          .in("status", ["aguardando_aceite", "em_validacao"]),
        supabase
          .from("point_cards")
          .select("id, employee_id, period_start, period_end, deadline_at")
          .is("signed_at", null)
          .not("published_at", "is", null),
        supabase
          .from("uniform_exchange_requests")
          .select("id, employee_id, reason, created_at")
          .in("status", ["solicitada", "em_analise", "aprovada", "aguardando_devolucao"]),
      ]);
      if (employees.error) throw employees.error;
      return {
        employees: employees.data ?? [],
        documents: documents.data ?? [],
        requests: requests.data ?? [],
        deliveries: deliveries.data ?? [],
        cards: cards.data ?? [],
        exchanges: exchanges.data ?? [],
      };
    },
  });

  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);

  const rows = useMemo(() => {
    const d = query.data;
    if (!d) return [];
    const byEmployee = new Map<string, Pendency[]>();
    const push = (employeeId: string, p: Pendency) => {
      const list = byEmployee.get(employeeId) ?? [];
      list.push(p);
      byEmployee.set(employeeId, list);
    };

    for (const doc of d.documents) {
      const effective = effectiveDocumentStatus(doc.status, doc.expires_at);
      if (effective === "vencido" || effective === "vence_em_breve" || effective === "aguardando_documento") {
        push(doc.employee_id, {
          kind: "documento",
          label: `${DOCUMENT_TYPE_LABEL[doc.document_type] ?? doc.document_type}: ${doc.title}`,
          due: doc.expires_at,
          critical: effective === "vencido",
        });
      }
    }
    for (const r of d.requests) {
      const days = daysUntil(r.due_at);
      push(r.employee_id, {
        kind: "documento",
        label: `Solicitação aberta: ${DOCUMENT_TYPE_LABEL[r.document_type] ?? r.document_type}`,
        due: r.due_at,
        critical: days != null && days < 0,
      });
    }
    for (const item of d.deliveries) {
      push(item.employee_id, {
        kind: "item",
        label: "Entrega de itens aguardando aceite",
        due: item.expires_at,
        critical: !!item.expires_at && new Date(item.expires_at) < new Date(),
      });
    }
    for (const c of d.cards) {
      push(c.employee_id, {
        kind: "ponto",
        label: `Cartão de ponto ${dateFmt(c.period_start)} — ${dateFmt(c.period_end)}`,
        due: c.deadline_at,
        critical: !!c.deadline_at && new Date(c.deadline_at) < new Date(),
      });
    }
    for (const x of d.exchanges) {
      push(x.employee_id, { kind: "troca", label: `Troca: ${x.reason}`, due: null, critical: false });
    }

    return d.employees
      .map((e) => ({ employee: e, pendencies: byEmployee.get(e.id) ?? [] }))
      .filter((row) => row.pendencies.length > 0)
      .filter((row) => (activeUnitId ? row.employee.unit_id === activeUnitId : true))
      .filter((row) => (search ? row.employee.full_name.toLowerCase().includes(search.toLowerCase()) : true))
      .filter((row) => (kind === "todas" ? true : row.pendencies.some((p) => p.kind === kind)))
      .sort((a, b) => b.pendencies.length - a.pendencies.length);
  }, [query.data, activeUnitId, search, kind]);

  if (query.isLoading) return <LoadingState rows={5} label="Carregando pendências…" />;
  if (query.isError)
    return <ErrorState action={<Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button>} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conformidade e equipe"
        title="Pendências da equipe"
        description="Cada colaborador com documentos, itens ou cartões de ponto aguardando ação."
      />

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Buscar colaborador"
          aria-label="Buscar colaborador"
          value={search}
          maxLength={80}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-52" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os tipos</SelectItem>
            <SelectItem value="documento">Documentos</SelectItem>
            <SelectItem value="item">Itens e uniformes</SelectItem>
            <SelectItem value="ponto">Cartões de ponto</SelectItem>
            <SelectItem value="troca">Trocas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nenhuma pendência" description="Toda a equipe está em dia com os filtros selecionados." />
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <SectionCard
              key={row.employee.id}
              title={row.employee.full_name}
              action={
                <StatusBadge tone={row.pendencies.some((p) => p.critical) ? "danger" : "warn"}>
                  {row.pendencies.length} pendência(s)
                </StatusBadge>
              }
            >
              <p className="meta-mono mb-3">
                {row.employee.unit_id ? unitMap.get(row.employee.unit_id) ?? "Unidade" : "Sem unidade"}
              </p>
              <ul className="space-y-2">
                {row.pendencies.map((p, index) => (
                  <li
                    key={`${row.employee.id}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-foreground bg-card px-4 py-2 text-sm shadow-[2px_2px_0_var(--ink)]"
                  >
                    <span className="font-semibold">{p.label}</span>
                    <span className="meta-mono">
                      {p.due ? `prazo ${dateFmt(p.due)}` : "sem prazo"}
                      {p.critical ? " · atrasado" : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/app/conformidade/exames" search={{ search: row.employee.full_name }}>
                  <Button variant="outline" size="sm">Ver documentos</Button>
                </Link>
                <Link to="/app/deliveries">
                  <Button variant="outline" size="sm">Ver entregas</Button>
                </Link>
                <Link to="/app/point-cards">
                  <Button variant="outline" size="sm">Ver cartões de ponto</Button>
                </Link>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}

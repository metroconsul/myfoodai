import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Download, PackageCheck, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { createDeliveries } from "@/lib/deliveries.functions";
import { PageHeader, SectionCard, EmptyState, StatusBadge, LoadingState, ErrorState, StatCard } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrDateTimeInput } from "@/components/ui/br-inputs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { dateTimeFmt, numberFmt } from "@/lib/format";
import { DELIVERY_REASONS, REASON_LABEL, STATUS_LABEL, STATUS_TONE, DELIVERY_STATUSES } from "@/lib/items.shared";

export const Route = createFileRoute("/_authenticated/app/deliveries/")({
  head: () => ({
    meta: [
      { title: `Entrega de itens — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Registre entregas individuais ou em lote e acompanhe o aceite dos colaboradores.",
      },
      { property: "og:title", content: `Entrega de itens — ${BRAND_NAME}` },
      { property: "og:description", content: "Controle de entregas e aceites de itens operacionais." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeliveriesPage,
});

type DraftItem = {
  key: string;
  catalogItemId: string;
  quantity: string;
  size: string;
  color: string;
  lot: string;
};

const newDraft = (): DraftItem => ({
  key: crypto.randomUUID(),
  catalogItemId: "",
  quantity: "1",
  size: "",
  color: "",
  lot: "",
});

function DeliveriesPage() {
  const { activeUnitId, activeUnit } = useWorkspace();
  const queryClient = useQueryClient();
  const create = useServerFn(createDeliveries);

  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [drafts, setDrafts] = useState<DraftItem[]>([newDraft()]);
  const [reason, setReason] = useState<string>("admissao");
  const [notes, setNotes] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(() => new Date().toISOString().slice(0, 16));

  const deliveriesQuery = useQuery({
    queryKey: ["item-deliveries", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_deliveries")
        .select(
          "id, status, reason, delivered_at, accepted_at, batch_id, employees(full_name, employee_code), item_delivery_items(id, item_name, quantity, size)",
        )
        .eq("unit_id", activeUnitId!)
        .order("delivered_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-delivery", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, role_id, roles(name)")
        .eq("unit_id", activeUnitId!)
        .neq("employment_status", "desligado")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items-for-delivery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("id, name, sizes, colors, requires_size, requires_color, quantity_per_delivery, unit_of_measure")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["delivery-rules-active", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_rules")
        .select("role_id, catalog_item_id, quantity, default_size, default_color")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const deliveries = deliveriesQuery.data ?? [];
  const filtered = deliveries.filter((d) => {
    const okStatus = statusFilter === "todos" || d.status === statusFilter;
    const term = search.trim().toLowerCase();
    const okTerm =
      !term ||
      (d.employees?.full_name ?? "").toLowerCase().includes(term) ||
      (d.item_delivery_items ?? []).some((i) => i.item_name.toLowerCase().includes(term));
    return okStatus && okTerm;
  });

  const pending = deliveries.filter((d) => d.status === "aguardando_aceite" || d.status === "em_validacao").length;
  const signed = deliveries.filter((d) => d.status === "assinado").length;
  const problems = deliveries.filter((d) => d.status === "recusado" || d.status === "divergente").length;

  const visibleEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    return employees.filter((e) => !term || e.full_name.toLowerCase().includes(term));
  }, [employees, employeeSearch]);

  const applyRules = () => {
    const roleIds = new Set(
      employees.filter((e) => selected.includes(e.id)).map((e) => e.role_id).filter(Boolean) as string[],
    );
    const matched = rules.filter((r) => !r.role_id || roleIds.has(r.role_id));
    if (matched.length === 0) {
      toast.info("Nenhuma regra encontrada para as funções selecionadas.");
      return;
    }
    setDrafts(
      matched.map((r) => ({
        key: crypto.randomUUID(),
        catalogItemId: r.catalog_item_id,
        quantity: String(Number(r.quantity)),
        size: r.default_size ?? "",
        color: r.default_color ?? "",
        lot: "",
      })),
    );
    toast.success(`${matched.length} item(ns) sugerido(s) pelas regras.`);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!activeUnitId) throw new Error("Selecione uma unidade ativa.");
      if (selected.length === 0) throw new Error("Selecione ao menos um colaborador.");
      const payloadItems = drafts
        .filter((d) => d.catalogItemId)
        .map((d) => ({
          catalogItemId: d.catalogItemId,
          quantity: Number(d.quantity) || 1,
          size: d.size || null,
          color: d.color || null,
          lot: d.lot || null,
        }));
      if (payloadItems.length === 0) throw new Error("Inclua ao menos um item.");

      for (const d of drafts.filter((x) => x.catalogItemId)) {
        const item = items.find((i) => i.id === d.catalogItemId);
        if (item?.requires_size && !d.size) throw new Error(`Informe o tamanho de ${item.name}.`);
        if (item?.requires_color && !d.color) throw new Error(`Informe a cor de ${item.name}.`);
      }

      const res = await create({
        data: {
          unitId: activeUnitId,
          employeeIds: selected,
          items: payloadItems,
          reason: reason as (typeof DELIVERY_REASONS)[number],
          notes: notes.trim() || null,
          deliveredAt: new Date(deliveredAt).toISOString(),
          responsibleLabel: null,
          allowPartial: false,
        },
      });
      if ("error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      const skipped = "skipped" in res ? res.skipped : [];
      toast.success(
        `${"createdCount" in res ? res.createdCount : 0} entrega(s) publicada(s) no portal.` +
          (skipped && skipped.length ? ` Não concluídas: ${skipped.join(", ")}.` : ""),
      );
      setOpen(false);
      setSelected([]);
      setDrafts([newDraft()]);
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["item-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["operational-items-stock"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar entrega."),
  });

  const exportCsv = () => {
    const header = ["Colaborador", "Status", "Motivo", "Itens", "Entregue em", "Aceite em"];
    const lines = filtered.map((d) => [
      d.employees?.full_name ?? "",
      STATUS_LABEL[d.status] ?? d.status,
      REASON_LABEL[d.reason] ?? d.reason,
      (d.item_delivery_items ?? []).map((i) => `${i.item_name} x${numberFmt(Number(i.quantity), 0)}`).join(" | "),
      dateTimeFmt(d.delivered_at),
      dateTimeFmt(d.accepted_at),
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `entregas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow="Itens e entregas"
        title="Entrega de itens"
        description={`Entregas registradas na unidade ${activeUnit?.name ?? ""}, com aceite auditável no portal.`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="size-4" aria-hidden />
              Exportar CSV
            </Button>
            <Button onClick={() => setOpen(true)} disabled={!activeUnitId}>
              Nova entrega
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Aguardando aceite"
          value={pending}
          tone={pending > 0 ? "warning" : "default"}
          icon={<Users className="size-5" aria-hidden />}
        />
        <StatCard label="Assinadas" value={signed} tone="success" icon={<PackageCheck className="size-5" aria-hidden />} />
        <StatCard label="Recusas e divergências" value={problems} tone={problems > 0 ? "danger" : "default"} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Buscar por colaborador ou item"
            aria-label="Buscar entregas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {DELIVERY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SectionCard title="Entregas">
        {deliveriesQuery.isLoading ? (
          <LoadingState rows={5} />
        ) : deliveriesQuery.isError ? (
          <ErrorState
            title="Não foi possível carregar as entregas"
            action={<Button onClick={() => deliveriesQuery.refetch()}>Tentar novamente</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhuma entrega registrada"
            description="Registre a primeira entrega para acompanhar o aceite dos colaboradores."
            action={
              <Button onClick={() => setOpen(true)} disabled={!activeUnitId}>
                Nova entrega
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((d) => (
              <li key={d.id}>
                <Link
                  to="/app/deliveries/$id"
                  params={{ id: d.id }}
                  className="hover-lift flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_var(--ink)]"
                >
                  <div className="min-w-0">
                    <p className="font-bold">{d.employees?.full_name ?? "Colaborador"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(d.item_delivery_items ?? [])
                        .map((i) => `${i.item_name}${i.size ? ` (${i.size})` : ""} x${numberFmt(Number(i.quantity), 0)}`)
                        .join(" · ") || "Sem itens"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {REASON_LABEL[d.reason] ?? d.reason} · {dateTimeFmt(d.delivered_at)}
                    </p>
                  </div>
                  <StatusBadge tone={STATUS_TONE[d.status] ?? "neutral"}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nova entrega de itens</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-widest">
                  Colaboradores ({selected.length})
                </h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(visibleEmployees.map((e) => e.id))}
                  >
                    Selecionar todos
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
                    Limpar
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Buscar colaborador"
                aria-label="Buscar colaborador"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
              />
              <ul className="max-h-52 space-y-1 overflow-y-auto rounded-[12px] border-2 border-foreground bg-secondary p-2">
                {visibleEmployees.map((e) => (
                  <li key={e.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-[8px] px-2 py-2 text-sm hover:bg-card">
                      <Checkbox
                        checked={selected.includes(e.id)}
                        onCheckedChange={(v) =>
                          setSelected(v === true ? [...selected, e.id] : selected.filter((id) => id !== e.id))
                        }
                      />
                      <span className="font-medium">{e.full_name}</span>
                      <span className="text-xs text-muted-foreground">{e.roles?.name ?? "Sem função"}</span>
                    </label>
                  </li>
                ))}
                {visibleEmployees.length === 0 ? (
                  <li className="px-2 py-3 text-sm text-muted-foreground">Nenhum colaborador nesta unidade.</li>
                ) : null}
              </ul>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-widest">Itens</h3>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={applyRules} disabled={selected.length === 0}>
                    Aplicar regras da função
                  </Button>
                  <Button type="button" size="sm" onClick={() => setDrafts([...drafts, newDraft()])}>
                    Adicionar item
                  </Button>
                </div>
              </div>
              <ul className="space-y-3">
                {drafts.map((draft, index) => {
                  const item = items.find((i) => i.id === draft.catalogItemId);
                  return (
                    <li key={draft.key} className="space-y-2 rounded-[12px] border-2 border-foreground bg-secondary p-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_100px_auto]">
                        <Select
                          value={draft.catalogItemId}
                          onValueChange={(v) => {
                            const picked = items.find((i) => i.id === v);
                            setDrafts(
                              drafts.map((d) =>
                                d.key === draft.key
                                  ? {
                                      ...d,
                                      catalogItemId: v,
                                      quantity: String(Number(picked?.quantity_per_delivery ?? 1)),
                                      size: "",
                                      color: "",
                                    }
                                  : d,
                              ),
                            );
                          }}
                        >
                          <SelectTrigger aria-label={`Item ${index + 1}`}>
                            <SelectValue placeholder="Escolha o item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          aria-label="Quantidade"
                          value={draft.quantity}
                          onChange={(e) =>
                            setDrafts(drafts.map((d) => (d.key === draft.key ? { ...d, quantity: e.target.value } : d)))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDrafts(drafts.filter((d) => d.key !== draft.key))}
                          disabled={drafts.length === 1}
                        >
                          Remover
                        </Button>
                      </div>
                      {item && ((item.sizes ?? []).length || (item.colors ?? []).length || true) ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {(item.sizes ?? []).length ? (
                            <Select
                              value={draft.size}
                              onValueChange={(v) =>
                                setDrafts(drafts.map((d) => (d.key === draft.key ? { ...d, size: v } : d)))
                              }
                            >
                              <SelectTrigger aria-label="Tamanho">
                                <SelectValue placeholder="Tamanho" />
                              </SelectTrigger>
                              <SelectContent>
                                {(item.sizes ?? []).map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                          {(item.colors ?? []).length ? (
                            <Select
                              value={draft.color}
                              onValueChange={(v) =>
                                setDrafts(drafts.map((d) => (d.key === draft.key ? { ...d, color: v } : d)))
                              }
                            >
                              <SelectTrigger aria-label="Cor">
                                <SelectValue placeholder="Cor" />
                              </SelectTrigger>
                              <SelectContent>
                                {(item.colors ?? []).map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                          <Input
                            placeholder="Lote (opcional)"
                            aria-label="Lote"
                            value={draft.lot}
                            onChange={(e) =>
                              setDrafts(drafts.map((d) => (d.key === draft.key ? { ...d, lot: e.target.value } : d)))
                            }
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {REASON_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delivery-date">Data e hora da entrega</Label>
                <BrDateTimeInput id="delivery-date" value={deliveredAt} onChange={setDeliveredAt} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="delivery-notes">Observações</Label>
                <Textarea
                  id="delivery-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instruções de uso, conservação ou devolução."
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              O estoque da unidade é baixado no momento da entrega e a pendência aparece no portal do colaborador
              para validação de identidade e assinatura.
            </p>

            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? "Registrando…" : `Registrar entrega (${selected.length})`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState, StatusBadge, LoadingState, ErrorState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrDateInput } from "@/components/ui/br-inputs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { dateFmt, numberFmt } from "@/lib/format";
import { PERIOD_LABEL, REPLACEMENT_PERIODS } from "@/lib/items.shared";

export const Route = createFileRoute("/_authenticated/app/delivery-rules")({
  head: () => ({
    meta: [
      { title: `Regras de entrega — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Defina quais itens cada função deve receber, com quantidade, tamanho padrão e periodicidade.",
      },
      { property: "og:title", content: `Regras de entrega — ${BRAND_NAME}` },
      { property: "og:description", content: "Itens obrigatórios por função e unidade." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeliveryRulesPage,
});

const EMPTY = {
  roleId: "",
  catalogItemId: "",
  quantity: "1",
  defaultSize: "",
  defaultColor: "",
  replacementPeriod: "sem_periodicidade",
  mandatory: true,
  startsOn: new Date().toISOString().slice(0, 10),
  endsOn: "",
};

function DeliveryRulesPage() {
  const { company, activeUnitId, activeUnit } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const rulesQuery = useQuery({
    queryKey: ["delivery-rules", activeUnitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_rules")
        .select("*, roles(name), catalog_items(name, unit_of_measure), units(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-basic"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("id, name, sizes, colors, quantity_per_delivery, replacement_period")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedItem = items.find((i) => i.id === form.catalogItemId);

  const create = useMutation({
    mutationFn: async () => {
      if (!company || !activeUnitId) throw new Error("Selecione uma unidade ativa.");
      if (!form.catalogItemId) throw new Error("Escolha o item.");
      const { error } = await supabase.from("delivery_rules").insert({
        company_id: company.id,
        unit_id: activeUnitId,
        role_id: form.roleId || null,
        catalog_item_id: form.catalogItemId,
        quantity: Number(form.quantity) || 1,
        default_size: form.defaultSize || null,
        default_color: form.defaultColor || null,
        replacement_period: form.replacementPeriod,
        mandatory: form.mandatory,
        starts_on: form.startsOn,
        ends_on: form.endsOn || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra criada.");
      setOpen(false);
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["delivery-rules"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar regra."),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("delivery_rules").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-rules"] }),
  });

  const rules = rulesQuery.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Itens e entregas"
        title="Regras por função"
        description="Itens que cada função deve receber ao ser admitida ou na troca periódica."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/items">Catálogo</Link>
            </Button>
            <Button onClick={() => setOpen(true)} disabled={!activeUnitId}>
              Nova regra
            </Button>
          </>
        }
      />

      <SectionCard title={`Regras da unidade ${activeUnit?.name ?? ""}`}>
        {rulesQuery.isLoading ? (
          <LoadingState rows={4} />
        ) : rulesQuery.isError ? (
          <ErrorState
            title="Não foi possível carregar as regras"
            action={<Button onClick={() => rulesQuery.refetch()}>Tentar novamente</Button>}
          />
        ) : rules.length === 0 ? (
          <EmptyState
            title="Nenhuma regra definida"
            description="Crie regras para sugerir automaticamente os itens de cada função na hora da entrega."
            action={
              <Button onClick={() => setOpen(true)} disabled={!activeUnitId}>
                Nova regra
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_var(--ink)]"
              >
                <div className="min-w-0">
                  <p className="font-bold">
                    {rule.catalog_items?.name ?? "Item"} · {numberFmt(Number(rule.quantity))}{" "}
                    {rule.catalog_items?.unit_of_measure ?? ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rule.roles?.name ? `Função: ${rule.roles.name}` : "Todas as funções"} ·{" "}
                    {PERIOD_LABEL[rule.replacement_period] ?? rule.replacement_period} · vigência a partir de{" "}
                    {dateFmt(rule.starts_on)}
                    {rule.ends_on ? ` até ${dateFmt(rule.ends_on)}` : ""}
                  </p>
                  {rule.default_size || rule.default_color ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Padrão: {[rule.default_size, rule.default_color].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={rule.mandatory ? "brand" : "neutral"}>
                    {rule.mandatory ? "Obrigatório" : "Opcional"}
                  </StatusBadge>
                  <StatusBadge tone={rule.active ? "ok" : "neutral"}>
                    {rule.active ? "Ativa" : "Inativa"}
                  </StatusBadge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive.mutate({ id: rule.id, active: !rule.active })}
                  >
                    {rule.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova regra de entrega</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Item</Label>
              <Select
                value={form.catalogItemId}
                onValueChange={(v) => {
                  const item = items.find((i) => i.id === v);
                  setForm({
                    ...form,
                    catalogItemId: v,
                    quantity: String(Number(item?.quantity_per_delivery ?? 1)),
                    replacementPeriod: item?.replacement_period ?? "sem_periodicidade",
                    defaultSize: "",
                    defaultColor: "",
                  });
                }}
              >
                <SelectTrigger>
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
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Função</Label>
                <Select value={form.roleId || "all"} onValueChange={(v) => setForm({ ...form, roleId: v === "all" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as funções</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-qty">Quantidade</Label>
                <Input
                  id="rule-qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              {(selectedItem?.sizes ?? []).length ? (
                <div className="space-y-1.5">
                  <Label>Tamanho padrão</Label>
                  <Select value={form.defaultSize} onValueChange={(v) => setForm({ ...form, defaultSize: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedItem?.sizes ?? []).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {(selectedItem?.colors ?? []).length ? (
                <div className="space-y-1.5">
                  <Label>Cor padrão</Label>
                  <Select value={form.defaultColor} onValueChange={(v) => setForm({ ...form, defaultColor: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedItem?.colors ?? []).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label>Periodicidade</Label>
                <Select
                  value={form.replacementPeriod}
                  onValueChange={(v) => setForm({ ...form, replacementPeriod: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPLACEMENT_PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PERIOD_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-start">Início da vigência</Label>
                <BrDateInput
                  id="rule-start"
                  value={form.startsOn}
                  onChange={(v) => setForm({ ...form, startsOn: v })}
                />
...
                <BrDateInput
                  id="rule-end"
                  value={form.endsOn}
                  onChange={(v) => setForm({ ...form, endsOn: v })}
                />
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm font-bold">
              <Checkbox
                checked={form.mandatory}
                onCheckedChange={(v) => setForm({ ...form, mandatory: v === true })}
              />
              Item de uso obrigatório
            </label>

            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? "Salvando…" : "Salvar regra"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

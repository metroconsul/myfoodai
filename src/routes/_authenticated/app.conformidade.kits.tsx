import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Shirt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { BRAND_NAME } from "@/config/brand";
import { PageHeader, SectionCard, EmptyState, LoadingState, ErrorState, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PERIOD_LABEL, REPLACEMENT_PERIODS } from "@/lib/items.shared";
import { dateFmt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/conformidade/kits")({
  head: () => ({
    meta: [
      { title: `Kits por função — ${BRAND_NAME}` },
      { name: "description", content: "Monte kits de uniformes e materiais por função, setor e unidade." },
      { property: "og:title", content: `Kits por função — ${BRAND_NAME}` },
      { property: "og:description", content: "Kits de uniformes e materiais por função." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KitsPage,
});

type Line = { itemId: string; quantity: string; size: string; color: string };

const EMPTY = {
  name: "",
  unitId: "",
  roleId: "",
  department: "",
  required: "true",
  replacementPeriod: "sem_periodicidade",
  effectiveFrom: "",
  effectiveUntil: "",
};

function KitsPage() {
  const { company, units } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [lines, setLines] = useState<Line[]>([{ itemId: "", quantity: "1", size: "", color: "" }]);

  const catalog = useQuery({
    queryKey: ["kit-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("id, name, sizes, colors")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["kit-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const kitsQuery = useQuery({
    queryKey: ["uniform-kits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uniform_kits")
        .select("*, uniform_kit_items(id, item_id, quantity, default_size, default_color)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const itemMap = useMemo(
    () => new Map((catalog.data ?? []).map((c) => [c.id, c.name])),
    [catalog.data],
  );
  const roleMap = useMemo(
    () => new Map((rolesQuery.data ?? []).map((r) => [r.id, r.name])),
    [rolesQuery.data],
  );
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);

  const create = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error("Empresa não encontrada.");
      if (!form.name.trim()) throw new Error("Informe o nome do kit.");
      const selected = lines.filter((l) => l.itemId);
      if (selected.length === 0) throw new Error("Adicione ao menos um item ao kit.");

      const { data: kit, error } = await supabase
        .from("uniform_kits")
        .insert({
          company_id: company.id,
          unit_id: form.unitId || null,
          role_id: form.roleId || null,
          name: form.name.trim(),
          department: form.department || null,
          required: form.required === "true",
          replacement_period: form.replacementPeriod,
          effective_from: form.effectiveFrom || null,
          effective_until: form.effectiveUntil || null,
        })
        .select("id")
        .maybeSingle();
      if (error || !kit) throw new Error("Não foi possível criar o kit.");

      const { error: itemsError } = await supabase.from("uniform_kit_items").insert(
        selected.map((l) => ({
          company_id: company.id,
          kit_id: kit.id,
          item_id: l.itemId,
          quantity: Number(l.quantity) || 1,
          default_size: l.size || null,
          default_color: l.color || null,
        })),
      );
      if (itemsError) throw new Error("Kit criado, mas os itens não foram salvos.");
    },
    onSuccess: () => {
      toast.success("Kit criado.");
      setOpen(false);
      setForm(EMPTY);
      setLines([{ itemId: "", quantity: "1", size: "", color: "" }]);
      queryClient.invalidateQueries({ queryKey: ["uniform-kits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("uniform_kits").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["uniform-kits"] }),
    onError: () => toast.error("Não foi possível atualizar o kit."),
  });

  if (kitsQuery.isLoading) return <LoadingState rows={4} label="Carregando kits…" />;
  if (kitsQuery.isError)
    return <ErrorState action={<Button variant="outline" onClick={() => kitsQuery.refetch()}>Tentar novamente</Button>} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Uniformes e itens"
        title="Kits por função"
        description="Agrupe uniformes e materiais sugeridos por função, setor ou unidade."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> Novo kit
          </Button>
        }
      />

      {(kitsQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="Nenhum kit cadastrado"
          description="Crie kits como Cozinha, Atendimento, Estoque, Varejo ou Limpeza."
          action={<Button onClick={() => setOpen(true)}>Criar primeiro kit</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(kitsQuery.data ?? []).map((kit) => (
            <SectionCard
              key={kit.id}
              title={kit.name}
              action={
                <StatusBadge tone={kit.active ? "ok" : "neutral"}>{kit.active ? "Ativo" : "Inativo"}</StatusBadge>
              }
            >
              <p className="meta-mono mb-3">
                {kit.role_id ? roleMap.get(kit.role_id) ?? "Função" : "Todas as funções"} ·{" "}
                {kit.unit_id ? unitMap.get(kit.unit_id) ?? "Unidade" : "Todas as unidades"} ·{" "}
                {kit.required ? "Obrigatório" : "Recomendado"} · {PERIOD_LABEL[kit.replacement_period] ?? "—"}
              </p>
              <ul className="space-y-1 text-sm">
                {(kit.uniform_kit_items ?? []).map((line) => (
                  <li key={line.id} className="flex items-center gap-2">
                    <Shirt className="size-4 shrink-0" aria-hidden />
                    <span className="font-semibold">{itemMap.get(line.item_id) ?? "Item"}</span>
                    <span className="meta-mono">
                      {Number(line.quantity)}x{line.default_size ? ` · ${line.default_size}` : ""}
                      {line.default_color ? ` · ${line.default_color}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {kit.effective_from || kit.effective_until ? (
                <p className="meta-mono mt-3">
                  Vigência {dateFmt(kit.effective_from)} — {dateFmt(kit.effective_until)}
                </p>
              ) : null}
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive.mutate({ id: kit.id, active: !kit.active })}
                >
                  {kit.active ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Os kits sugerem itens na admissão ou mudança de função. A entrega continua sendo criada manualmente pelo
        gestor em Entrega de itens.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo kit por função</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="kitName">Nome</Label>
                <Input id="kitName" value={form.name} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="dep">Setor</Label>
                <Input id="dep" value={form.department} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
              </div>
              <div>
                <Label>Função</Label>
                <Select value={form.roleId} onValueChange={(v) => setForm((f) => ({ ...f, roleId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Todas as funções" /></SelectTrigger>
                  <SelectContent>
                    {(rolesQuery.data ?? []).map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={form.unitId} onValueChange={(v) => setForm((f) => ({ ...f, unitId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Obrigatoriedade</Label>
                <Select value={form.required} onValueChange={(v) => setForm((f) => ({ ...f, required: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Obrigatório</SelectItem>
                    <SelectItem value="false">Recomendado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Periodicidade</Label>
                <Select value={form.replacementPeriod} onValueChange={(v) => setForm((f) => ({ ...f, replacementPeriod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPLACEMENT_PERIODS.map((p) => (<SelectItem key={p} value={p}>{PERIOD_LABEL[p]}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="from">Vigência inicial</Label>
                <Input id="from" type="date" value={form.effectiveFrom} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="until">Vigência final</Label>
                <Input id="until" type="date" value={form.effectiveUntil} onChange={(e) => setForm((f) => ({ ...f, effectiveUntil: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Itens do kit</Label>
              {lines.map((line, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[2fr_0.6fr_0.8fr_0.8fr_auto]">
                  <Select
                    value={line.itemId}
                    onValueChange={(v) =>
                      setLines((prev) => prev.map((l, i) => (i === index ? { ...l, itemId: v } : l)))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                    <SelectContent>
                      {(catalog.data ?? []).map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label="Quantidade"
                    value={line.quantity}
                    onChange={(e) => setLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))}
                  />
                  <Input
                    aria-label="Tamanho padrão"
                    placeholder="Tamanho"
                    value={line.size}
                    onChange={(e) => setLines((prev) => prev.map((l, i) => (i === index ? { ...l, size: e.target.value } : l)))}
                  />
                  <Input
                    aria-label="Cor padrão"
                    placeholder="Cor"
                    value={line.color}
                    onChange={(e) => setLines((prev) => prev.map((l, i) => (i === index ? { ...l, color: e.target.value } : l)))}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Remover item"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, { itemId: "", quantity: "1", size: "", color: "" }])}
              >
                Adicionar item
              </Button>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>Salvar kit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

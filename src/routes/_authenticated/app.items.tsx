import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { uploadPhoto } from "@/hooks/use-signed-url";
import { ItemPhoto } from "@/components/item-photo";
import { PageHeader, SectionCard, EmptyState, StatusBadge, LoadingState, ErrorState, StatCard } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { currency, numberFmt } from "@/lib/format";
import {
  CATEGORY_LABEL,
  CATEGORY_TO_ITEM_TYPE,
  ITEM_CATEGORIES,
  PERIOD_LABEL,
  REPLACEMENT_PERIODS,
  SIZE_PRESETS,
  UNITS_OF_MEASURE,
  stockTone,
} from "@/lib/items.shared";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/items")({
  head: () => ({
    meta: [
      { title: `Itens operacionais — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Cadastro de uniformes, materiais e itens de uso obrigatório com tamanhos, cores e estoque.",
      },
      { property: "og:title", content: `Itens operacionais — ${BRAND_NAME}` },
      { property: "og:description", content: "Gestão de itens entregues aos colaboradores." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ItemsPage,
});

type CatalogItem = Tables<"catalog_items">;

const EMPTY = {
  name: "",
  sku: "",
  description: "",
  brand: "",
  category: "uniforme",
  unitOfMeasure: "unidade",
  requiresSize: false,
  sizes: [] as string[],
  requiresColor: false,
  colors: "",
  quantityPerDelivery: "1",
  replacementPeriod: "sem_periodicidade",
  requiresReturn: false,
  storageLocation: "",
  unitCost: "",
  minimumStock: "0",
  status: "ativo",
};

function ItemsPage() {
  const { company, activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");

  const itemsQuery = useQuery({
    queryKey: ["operational-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalog_items").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const stockQuery = useQuery({
    queryKey: ["operational-items-stock", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("catalog_item_id, quantity, minimum_stock")
        .eq("unit_id", activeUnitId!);
      if (error) throw error;
      return data;
    },
  });

  const stockMap = useMemo(() => {
    const map = new Map<string, { quantity: number; minimum: number }>();
    for (const row of stockQuery.data ?? []) {
      if (!row.catalog_item_id) continue;
      map.set(row.catalog_item_id, {
        quantity: Number(row.quantity),
        minimum: Number(row.minimum_stock),
      });
    }
    return map;
  }, [stockQuery.data]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setFile(null);
    setOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setFile(null);
    setForm({
      name: item.name,
      sku: item.sku ?? "",
      description: item.description ?? "",
      brand: item.brand ?? "",
      category: item.category ?? "uniforme",
      unitOfMeasure: item.unit_of_measure ?? "unidade",
      requiresSize: item.requires_size,
      sizes: item.sizes ?? [],
      requiresColor: item.requires_color,
      colors: (item.colors ?? []).join(", "),
      quantityPerDelivery: String(Number(item.quantity_per_delivery ?? 1)),
      replacementPeriod: item.replacement_period ?? "sem_periodicidade",
      requiresReturn: item.requires_return,
      storageLocation: item.storage_location ?? "",
      unitCost: item.unit_cost != null ? String(Number(item.unit_cost)) : "",
      minimumStock: String(Number(item.minimum_stock ?? 0)),
      status: item.status ?? "ativo",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      if (form.name.trim().length < 2) throw new Error("Informe o nome do item.");
      if (form.requiresSize && form.sizes.length === 0) {
        throw new Error("Selecione ao menos um tamanho disponível.");
      }
      const photoPath = file ? await uploadPhoto("item-photos", company.id, file) : undefined;
      const payload = {
        company_id: company.id,
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        description: form.description.trim() || null,
        brand: form.brand.trim() || null,
        category: form.category,
        item_type: CATEGORY_TO_ITEM_TYPE[form.category] ?? "consumo",
        unit_of_measure: form.unitOfMeasure,
        requires_size: form.requiresSize,
        sizes: form.requiresSize ? form.sizes : [],
        requires_color: form.requiresColor,
        colors: form.requiresColor
          ? form.colors
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean)
          : [],
        quantity_per_delivery: Number(form.quantityPerDelivery) || 1,
        replacement_period: form.replacementPeriod,
        requires_return: form.requiresReturn,
        storage_location: form.storageLocation.trim() || null,
        unit_cost: form.unitCost ? Number(form.unitCost) : null,
        minimum_stock: Number(form.minimumStock) || 0,
        status: form.status,
        active: form.status === "ativo",
        ...(photoPath ? { photo_url: photoPath } : {}),
      };

      if (editing) {
        const { error } = await supabase.from("catalog_items").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("catalog_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Item atualizado." : "Item cadastrado.");
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["operational-items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar item."),
  });

  const items = itemsQuery.data ?? [];
  const visible = items.filter((item) => {
    const matchesCategory = categoryFilter === "todas" || item.category === categoryFilter;
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      item.name.toLowerCase().includes(term) ||
      (item.sku ?? "").toLowerCase().includes(term) ||
      (item.brand ?? "").toLowerCase().includes(term);
    return matchesCategory && matchesTerm;
  });

  const lowStock = items.filter((item) => {
    const s = stockMap.get(item.id);
    return s && s.quantity <= s.minimum;
  }).length;

  return (
    <>
      <PageHeader
        eyebrow="Itens e entregas"
        title="Itens operacionais"
        description="Uniformes, materiais e itens de uso obrigatório entregues à equipe."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/delivery-rules">Regras por função</Link>
            </Button>
            <Button onClick={openNew}>Novo item</Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Itens cadastrados" value={items.length} icon={<Package className="size-5" aria-hidden />} />
        <StatCard label="Ativos" value={items.filter((i) => i.active).length} tone="success" />
        <StatCard
          label="Estoque baixo na unidade"
          value={lowStock}
          tone={lowStock > 0 ? "warning" : "default"}
          hint="Considera o estoque da unidade ativa."
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, código ou marca"
            aria-label="Buscar itens"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(["todas", ...ITEM_CATEGORIES] as const).map((c) => (
          <Button
            key={c}
            size="sm"
            variant={categoryFilter === c ? "default" : "outline"}
            onClick={() => setCategoryFilter(c)}
          >
            {c === "todas" ? "Todas" : CATEGORY_LABEL[c]}
          </Button>
        ))}
      </div>

      <SectionCard title="Catálogo">
        {itemsQuery.isLoading ? (
          <LoadingState rows={4} />
        ) : itemsQuery.isError ? (
          <ErrorState
            title="Não foi possível carregar os itens"
            action={<Button onClick={() => itemsQuery.refetch()}>Tentar novamente</Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nenhum item encontrado"
            description="Cadastre os uniformes e materiais que a operação entrega à equipe."
            action={<Button onClick={openNew}>Novo item</Button>}
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {visible.map((item) => {
              const stock = stockMap.get(item.id);
              const tone = stockTone(stock?.quantity ?? 0, stock?.minimum ?? 0, item.active);
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-[12px] border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_var(--ink)]"
                >
                  <ItemPhoto path={item.photo_url} alt={item.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold">{item.name}</p>
                      <StatusBadge tone={item.active ? "brand" : "neutral"}>
                        {CATEGORY_LABEL[item.category ?? "outro"] ?? "Personalizada"}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.sku ? `${item.sku} · ` : ""}
                      {item.unit_of_measure} · {PERIOD_LABEL[item.replacement_period ?? "sem_periodicidade"]}
                      {item.requires_return ? " · exige devolução" : ""}
                    </p>
                    {item.requires_size && (item.sizes ?? []).length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tamanhos: {(item.sizes ?? []).join(", ")}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={tone.tone}>{tone.label}</StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {stock ? `${numberFmt(stock.quantity)} em estoque` : "Sem estoque nesta unidade"}
                        {item.unit_cost != null ? ` · ${currency(Number(item.unit_cost))}` : ""}
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                    Editar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar item" : "Novo item operacional"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="item-name">Nome do item</Label>
                <Input
                  id="item-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-sku">Código interno</Label>
                <Input
                  id="item-sku"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-brand">Marca ou fornecedor</Label>
                <Input
                  id="item-brand"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="item-desc">Descrição</Label>
                <Textarea
                  id="item-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unidade de medida</Label>
                <Select
                  value={form.unitOfMeasure}
                  onValueChange={(v) => setForm({ ...form, unitOfMeasure: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS_OF_MEASURE.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-qty">Quantidade padrão por entrega</Label>
                <Input
                  id="item-qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantityPerDelivery}
                  onChange={(e) => setForm({ ...form, quantityPerDelivery: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Periodicidade de troca</Label>
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
                <Label htmlFor="item-min">Estoque mínimo</Label>
                <Input
                  id="item-min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumStock}
                  onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-cost">Custo unitário (R$)</Label>
                <Input
                  id="item-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-storage">Local de armazenamento</Label>
                <Input
                  id="item-storage"
                  value={form.storageLocation}
                  onChange={(e) => setForm({ ...form, storageLocation: e.target.value })}
                  placeholder="Ex.: Almoxarifado A"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Situação</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-[12px] border-2 border-foreground bg-secondary p-4">
              <label className="flex items-center gap-3 text-sm font-bold">
                <Checkbox
                  checked={form.requiresSize}
                  onCheckedChange={(v) => setForm({ ...form, requiresSize: v === true })}
                />
                Exige tamanho
              </label>
              {form.requiresSize ? (
                <div className="flex flex-wrap gap-2">
                  {SIZE_PRESETS.map((size) => {
                    const active = form.sizes.includes(size);
                    return (
                      <Button
                        key={size}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() =>
                          setForm({
                            ...form,
                            sizes: active ? form.sizes.filter((s) => s !== size) : [...form.sizes, size],
                          })
                        }
                      >
                        {size}
                      </Button>
                    );
                  })}
                </div>
              ) : null}

              <label className="flex items-center gap-3 text-sm font-bold">
                <Checkbox
                  checked={form.requiresColor}
                  onCheckedChange={(v) => setForm({ ...form, requiresColor: v === true })}
                />
                Exige cor
              </label>
              {form.requiresColor ? (
                <Input
                  aria-label="Cores disponíveis"
                  value={form.colors}
                  onChange={(e) => setForm({ ...form, colors: e.target.value })}
                  placeholder="Preto, Branco, Vinho"
                />
              ) : null}

              <label className="flex items-center gap-3 text-sm font-bold">
                <Checkbox
                  checked={form.requiresReturn}
                  onCheckedChange={(v) => setForm({ ...form, requiresReturn: v === true })}
                />
                Exige devolução ao fim do uso
              </label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-photo">Foto do item</Label>
              <Input
                id="item-photo"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                A foto aparece no comprovante e ajuda o colaborador a conferir o que recebeu.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar item"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

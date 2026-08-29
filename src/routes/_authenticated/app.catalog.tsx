import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { uploadPhoto } from "@/hooks/use-signed-url";
import { ItemPhoto } from "@/components/item-photo";
import { PageHeader, SectionCard, EmptyState, StatusBadge, LoadingState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const ITEM_TYPES: Enums<"item_type">[] = [
  "protecao_individual",
  "uniforme",
  "ingrediente",
  "embalagem",
  "limpeza",
  "consumo",
];

const TYPE_LABEL: Record<Enums<"item_type">, string> = {
  protecao_individual: "Proteção individual",
  uniforme: "Uniforme",
  ingrediente: "Ingrediente",
  embalagem: "Embalagem",
  limpeza: "Limpeza",
  consumo: "Consumo",
};

export const Route = createFileRoute("/_authenticated/app/catalog")({
  head: () => ({
    meta: [
      { title: `Catálogo de itens — ${BRAND_NAME}` },
      { name: "description", content: "Cadastro visual de itens operacionais com foto, tipo e estoque mínimo." },
      { property: "og:title", content: `Catálogo de itens — ${BRAND_NAME}` },
      { property: "og:description", content: "Itens padrão da operação com foto e unidade de medida." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CatalogPage,
});

const EMPTY = {
  name: "",
  category: "",
  itemType: "ingrediente" as Enums<"item_type">,
  unitOfMeasure: "un",
  minimumStock: "0",
};

function CatalogPage() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<"todos" | Enums<"item_type">>("todos");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["catalog-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalog_items").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createItem = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      const photoPath = file ? await uploadPhoto("item-photos", company.id, file) : null;
      const { error } = await supabase.from("catalog_items").insert({
        company_id: company.id,
        name: form.name.trim(),
        category: form.category.trim() || null,
        item_type: form.itemType,
        unit_of_measure: form.unitOfMeasure.trim() || "un",
        minimum_stock: Number(form.minimumStock) || 0,
        photo_url: photoPath,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item cadastrado.");
      setOpen(false);
      setForm(EMPTY);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["catalog-items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao cadastrar item."),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("catalog_items").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["catalog-items"] }),
  });

  const visible = items.filter((i) => filter === "todos" || i.item_type === filter);

  return (
    <>
      <PageHeader
        title="Catálogo de itens"
        description="Itens padrão da empresa: EPI, uniformes, ingredientes, embalagens e limpeza."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Novo item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo item do catálogo</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createItem.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="cat-name">Nome</Label>
                  <Input
                    id="cat-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select
                      value={form.itemType}
                      onValueChange={(v) => setForm({ ...form, itemType: v as Enums<"item_type"> })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-category">Categoria</Label>
                    <Input
                      id="cat-category"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="Ex.: Hortifruti"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-uom">Unidade de medida</Label>
                    <Input
                      id="cat-uom"
                      value={form.unitOfMeasure}
                      onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}
                      placeholder="un, kg, L, cx"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-min">Estoque mínimo</Label>
                    <Input
                      id="cat-min"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.minimumStock}
                      onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-photo">Foto do item</Label>
                  <Input
                    id="cat-photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A foto ajuda a equipe a identificar o item durante a contagem.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={createItem.isPending}>
                  {createItem.isPending ? "Salvando…" : "Salvar item"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["todos", ...ITEM_TYPES] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={filter === t ? "default" : "outline"}
            onClick={() => setFilter(t)}
          >
            {t === "todos" ? "Todos" : TYPE_LABEL[t]}
          </Button>
        ))}
      </div>

      <SectionCard title="Itens cadastrados">
        {isLoading ? (
          <LoadingState />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nenhum item no catálogo"
            description="Cadastre os itens que a operação usa no dia a dia."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-[12px] border-2 border-foreground bg-card p-3">
                <ItemPhoto path={item.photo_url} alt={item.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABEL[item.item_type]} · {item.unit_of_measure} · mín. {Number(item.minimum_stock)}
                  </p>
                  {item.category ? (
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge tone={item.active ? "ok" : "neutral"}>
                    {item.active ? "Ativo" : "Inativo"}
                  </StatusBadge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive.mutate({ id: item.id, active: !item.active })}
                  >
                    {item.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

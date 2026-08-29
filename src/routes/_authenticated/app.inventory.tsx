import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { uploadPhoto } from "@/hooks/use-signed-url";
import { ItemPhoto } from "@/components/item-photo";
import { applyStockMovement } from "@/lib/inventory.functions";
import { PageHeader, SectionCard, EmptyState, StatCard, StatusBadge, LoadingState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { currency, dateTimeFmt, numberFmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, AlertTriangle, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const MOVEMENTS: Enums<"movement_type">[] = [
  "entrada",
  "saida",
  "ajuste",
  "perda",
  "transferencia",
  "inventario",
];

const MOVEMENT_LABEL: Record<Enums<"movement_type">, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  perda: "Perda",
  transferencia: "Transferência",
  inventario: "Inventário",
};

const ITEM_TYPES: Enums<"item_type">[] = [
  "protecao_individual",
  "uniforme",
  "ingrediente",
  "embalagem",
  "limpeza",
  "consumo",
];

export const Route = createFileRoute("/_authenticated/app/inventory")({
  head: () => ({
    meta: [
      { title: `Estoque — ${BRAND_NAME}` },
      { name: "description", content: "Estoque por unidade com fotos, movimentações e histórico auditável." },
      { property: "og:title", content: `Estoque — ${BRAND_NAME}` },
      { property: "og:description", content: "Controle visual de estoque e movimentações da unidade." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InventoryPage,
});

const EMPTY_ITEM = {
  name: "",
  category: "",
  itemType: "ingrediente" as Enums<"item_type">,
  unitOfMeasure: "un",
  quantity: "0",
  minimumStock: "0",
  unitCost: "",
  catalogItemId: "",
};

function InventoryPage() {
  const { company, activeUnitId, activeUnit, units } = useWorkspace();
  const queryClient = useQueryClient();
  const applyMovement = useServerFn(applyStockMovement);

  const [openItem, setOpenItem] = useState(false);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [file, setFile] = useState<File | null>(null);
  const [movementFor, setMovementFor] = useState<{ id: string; name: string; uom: string } | null>(null);
  const [movement, setMovement] = useState({
    type: "entrada" as Enums<"movement_type">,
    quantity: "1",
    unitCost: "",
    reason: "",
    targetUnitId: "",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    queryClient.invalidateQueries({ queryKey: ["stock-alerts"] });
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-items", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("unit_id", activeUnitId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["stock-movements", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, inventory_items(name, unit_of_measure), units!stock_movements_target_unit_id_fkey(name)")
        .eq("unit_id", activeUnitId!)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["stock-alerts", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_alerts")
        .select("*, inventory_items(name)")
        .eq("unit_id", activeUnitId!)
        .is("resolved_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createItem = useMutation({
    mutationFn: async () => {
      if (!company || !activeUnitId) throw new Error("Selecione uma unidade.");
      const source = catalog.find((c) => c.id === form.catalogItemId);
      const photoPath = file
        ? await uploadPhoto("item-photos", company.id, file)
        : (source?.photo_url ?? null);
      const { error } = await supabase.from("inventory_items").insert({
        company_id: company.id,
        unit_id: activeUnitId,
        catalog_item_id: source?.id ?? null,
        name: (form.name || source?.name || "").trim(),
        category: form.category.trim() || source?.category || null,
        item_type: source?.item_type ?? form.itemType,
        unit_of_measure: (form.unitOfMeasure || source?.unit_of_measure || "un").trim(),
        quantity: Number(form.quantity) || 0,
        minimum_stock: Number(form.minimumStock) || 0,
        unit_cost: form.unitCost ? Number(form.unitCost) : null,
        photo_url: photoPath,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item adicionado ao estoque da unidade.");
      setOpenItem(false);
      setForm(EMPTY_ITEM);
      setFile(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao adicionar item."),
  });

  const registerMovement = useMutation({
    mutationFn: async () => {
      if (!movementFor) throw new Error("Selecione um item.");
      const result = await applyMovement({
        data: {
          inventoryItemId: movementFor.id,
          movementType: movement.type,
          quantity: Number(movement.quantity),
          unitCost: movement.unitCost ? Number(movement.unitCost) : null,
          reason: movement.reason.trim() || null,
          targetUnitId: movement.type === "transferencia" && movement.targetUnitId ? movement.targetUnitId : null,
        },
      });
      if ("error" in result && result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada.");
      setMovementFor(null);
      setMovement({ type: "entrada", quantity: "1", unitCost: "", reason: "", targetUnitId: "" });
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro na movimentação."),
  });

  const low = items.filter((i) => Number(i.quantity) <= Number(i.minimum_stock));
  const totalValue = items.reduce((acc, i) => acc + Number(i.quantity) * Number(i.unit_cost ?? 0), 0);

  if (!activeUnitId) {
    return (
      <>
        <PageHeader title="Estoque" />
        <EmptyState title="Selecione uma unidade" description="O estoque é controlado por unidade." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Estoque"
        description={`Itens, movimentações e histórico auditável de ${activeUnit?.name ?? "sua unidade"}.`}
        actions={
          <Dialog open={openItem} onOpenChange={setOpenItem}>
            <DialogTrigger asChild>
              <Button>Adicionar item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Item no estoque da unidade</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createItem.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label>Usar item do catálogo</Label>
                  <Select
                    value={form.catalogItemId || "none"}
                    onValueChange={(v) => {
                      const source = catalog.find((c) => c.id === v);
                      setForm({
                        ...form,
                        catalogItemId: v === "none" ? "" : v,
                        name: source?.name ?? form.name,
                        unitOfMeasure: source?.unit_of_measure ?? form.unitOfMeasure,
                        minimumStock: source ? String(source.minimum_stock) : form.minimumStock,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Item avulso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Item avulso</SelectItem>
                      {catalog.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-name">Nome</Label>
                  <Input
                    id="inv-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {!form.catalogItemId ? (
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
                              {t.replaceAll("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-uom">Unidade de medida</Label>
                    <Input
                      id="inv-uom"
                      value={form.unitOfMeasure}
                      onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-qty">Quantidade inicial</Label>
                    <Input
                      id="inv-qty"
                      type="number"
                      step="0.01"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-min">Estoque mínimo</Label>
                    <Input
                      id="inv-min"
                      type="number"
                      step="0.01"
                      value={form.minimumStock}
                      onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-cost">Custo unitário (R$)</Label>
                    <Input
                      id="inv-cost"
                      type="number"
                      step="0.01"
                      value={form.unitCost}
                      onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-photo">Foto</Label>
                  <Input
                    id="inv-photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createItem.isPending}>
                  {createItem.isPending ? "Salvando…" : "Salvar item"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Itens ativos" value={items.length} icon={<Boxes className="size-5" />} />
        <StatCard
          label="Abaixo do mínimo"
          value={low.length}
          tone={low.length > 0 ? "warning" : "success"}
          hint={`${alerts.length} alertas abertos`}
          icon={<AlertTriangle className="size-5" />}
        />
        <StatCard
          label="Valor estimado"
          value={currency(totalValue)}
          hint="Quantidade × custo unitário"
          icon={<PackageCheck className="size-5" />}
        />
      </div>

      <Tabs defaultValue="itens" className="mt-6">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="mt-4">
          <SectionCard title="Estoque da unidade">
            {isLoading ? (
              <LoadingState />
            ) : items.length === 0 ? (
              <EmptyState
                title="Nenhum item no estoque desta unidade"
                description="Adicione itens do catálogo ou avulsos para começar a controlar."
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  const isLow = Number(item.quantity) <= Number(item.minimum_stock);
                  return (
                    <li key={item.id} className="flex items-center gap-3 rounded-[12px] border-2 border-foreground bg-card p-3">
                      <ItemPhoto path={item.photo_url} alt={item.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {numberFmt(Number(item.quantity))} {item.unit_of_measure} · mín.{" "}
                          {numberFmt(Number(item.minimum_stock))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Última movimentação: {dateTimeFmt(item.last_movement_at)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge tone={isLow ? "warn" : "ok"}>{isLow ? "Repor" : "Ok"}</StatusBadge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setMovementFor({ id: item.id, name: item.name, uom: item.unit_of_measure })
                          }
                        >
                          Movimentar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <SectionCard title="Histórico auditável">
            {movements.length === 0 ? (
              <EmptyState title="Sem movimentações" description="Entradas, saídas e ajustes aparecem aqui." />
            ) : (
              <ul className="divide-y-2 divide-foreground">
                {movements.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {(m.inventory_items as { name: string } | null)?.name ?? "Item"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {MOVEMENT_LABEL[m.movement_type]} · {dateTimeFmt(m.occurred_at)}
                        {m.reason ? ` · ${m.reason}` : ""}
                        {(m.units as { name: string } | null)?.name
                          ? ` · destino ${(m.units as { name: string }).name}`
                          : ""}
                      </span>
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      <span className="block font-medium text-foreground">
                        {numberFmt(Number(m.quantity))}{" "}
                        {(m.inventory_items as { unit_of_measure: string } | null)?.unit_of_measure ?? ""}
                      </span>
                      {numberFmt(Number(m.quantity_before))} → {numberFmt(Number(m.quantity_after))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="alertas" className="mt-4">
          <SectionCard title="Alertas abertos">
            {alerts.length === 0 ? (
              <EmptyState title="Nenhum alerta aberto" description="Estoques dentro do mínimo definido." />
            ) : (
              <ul className="divide-y-2 divide-foreground">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium">
                        {(a.inventory_items as { name: string } | null)?.name ?? "Item"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.message ?? a.alert_type.replaceAll("_", " ")} · {dateTimeFmt(a.created_at)}
                      </span>
                    </span>
                    <StatusBadge tone="warn">{a.alert_type.replaceAll("_", " ")}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={!!movementFor} onOpenChange={(o) => !o && setMovementFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentar {movementFor?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              registerMovement.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Tipo de movimentação</Label>
              <Select
                value={movement.type}
                onValueChange={(v) => setMovement({ ...movement, type: v as Enums<"movement_type"> })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENTS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MOVEMENT_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {movement.type === "inventario"
                  ? "A quantidade informada passa a ser o saldo final contado."
                  : movement.type === "ajuste"
                    ? "Use valores negativos para reduzir o saldo."
                    : "A quantidade é somada ou subtraída do saldo atual."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mv-qty">Quantidade ({movementFor?.uom})</Label>
                <Input
                  id="mv-qty"
                  type="number"
                  step="0.01"
                  required
                  value={movement.quantity}
                  onChange={(e) => setMovement({ ...movement, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mv-cost">Custo unitário (R$)</Label>
                <Input
                  id="mv-cost"
                  type="number"
                  step="0.01"
                  value={movement.unitCost}
                  onChange={(e) => setMovement({ ...movement, unitCost: e.target.value })}
                />
              </div>
            </div>
            {movement.type === "transferencia" ? (
              <div className="space-y-1.5">
                <Label>Unidade de destino</Label>
                <Select
                  value={movement.targetUnitId}
                  onValueChange={(v) => setMovement({ ...movement, targetUnitId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {units
                      .filter((u) => u.id !== activeUnitId)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="mv-reason">Motivo / observação</Label>
              <Textarea
                id="mv-reason"
                value={movement.reason}
                onChange={(e) => setMovement({ ...movement, reason: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={registerMovement.isPending}>
              {registerMovement.isPending ? "Registrando…" : "Registrar movimentação"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

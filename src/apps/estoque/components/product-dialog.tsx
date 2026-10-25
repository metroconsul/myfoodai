import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { EPI_TYPES, ITEM_TYPE_LABEL, STOCK_TYPES, UNITS, parseNumber, qty } from "../lib/labels";
import { estoqueKey, useCategories, type StockItem } from "../lib/queries";

type ItemType = Database["public"]["Enums"]["item_type"];

/**
 * Cadastro/edição de produto da unidade.
 * Produto = catálogo da empresa (catalog_items); saldo = inventory_items da unidade. Se já existe um produto com o
 * mesmo nome na empresa, ele é reaproveitado (sem cadastro duplicado). Saldo inicial vira "saldo inicial" no histórico.
 */
export function ProductDialog({ open, onClose, item }: { open: boolean; onClose: () => void; item?: StockItem | null }) {
  const { company, activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<ItemType>("ingrediente");
  const [unit, setUnit] = useState<string>("un");
  const [minimum, setMinimum] = useState("");
  const [cost, setCost] = useState("");
  const [initial, setInitial] = useState("");
  const [active, setActive] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const key = open ? (item?.id ?? "novo") : null;
  if (key !== openKey) {
    setOpenKey(key);
    setName(item?.name ?? "");
    setCategory(item?.category ?? "");
    setType((item?.item_type as ItemType) ?? "ingrediente");
    setUnit(item?.unit_of_measure ?? "un");
    setMinimum(item ? qty(item.minimum_stock).replace(/\./g, "") : "");
    setCost(item?.unit_cost != null ? String(item.unit_cost).replace(".", ",") : "");
    setInitial("");
    setActive(item?.active ?? true);
  }

  const min = minimum.trim() === "" ? 0 : parseNumber(minimum);
  const unitCost = cost.trim() === "" ? null : parseNumber(cost);
  const start = initial.trim() === "" ? 0 : parseNumber(initial);
  const valid =
    name.trim().length > 1 && Number.isFinite(min) && min >= 0 && (unitCost == null || (Number.isFinite(unitCost) && unitCost >= 0)) && Number.isFinite(start) && start >= 0;

  const save = useMutation({
    mutationFn: async () => {
      const fields = { name: name.trim(), category: category.trim() || null, unit_of_measure: unit };
      if (item) {
        // Nome, categoria e unidade valem para o produto em todas as unidades; mínimo e custo, só nesta.
        const { error: e1 } = await supabase.from("catalog_items").update(fields).eq("id", item.catalog_item_id!);
        if (e1) throw e1;
        const { error: e2 } = await supabase
          .from("inventory_items")
          .update({ ...fields, minimum_stock: min, unit_cost: unitCost, active })
          .eq("id", item.id);
        if (e2) throw e2;
        await supabase.from("inventory_items").update(fields).eq("catalog_item_id", item.catalog_item_id!).neq("id", item.id);
        return "Produto atualizado.";
      }

      const { data: existing } = await supabase.from("catalog_items").select("id").ilike("name", fields.name.replace(/[%_\\]/g, (m) => `\\${m}`)).limit(1).maybeSingle();
      let catalogId = existing?.id ?? null;
      if (catalogId) {
        const { data: here } = await supabase
          .from("inventory_items")
          .select("id")
          .eq("unit_id", activeUnitId!)
          .eq("catalog_item_id", catalogId)
          .maybeSingle();
        if (here) throw new Error("Este produto já está cadastrado nesta unidade.");
      } else {
        const { data: created, error } = await supabase
          .from("catalog_items")
          .insert({ ...fields, company_id: company!.id, item_type: type, minimum_stock: min, unit_cost: unitCost })
          .select("id")
          .single();
        if (error || !created) throw error ?? new Error("Não foi possível cadastrar o produto.");
        catalogId = created.id;
      }
      const { error } = await supabase.from("inventory_items").insert({
        ...fields,
        company_id: company!.id,
        unit_id: activeUnitId!,
        catalog_item_id: catalogId,
        item_type: type,
        quantity: start,
        minimum_stock: min,
        unit_cost: unitCost,
      });
      if (error) throw error;
      return existing ? "Produto da empresa adicionado a esta unidade." : "Produto cadastrado.";
    },
    onSuccess: (msg) => {
      toast.success(msg);
      void queryClient.invalidateQueries({ queryKey: estoqueKey });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar o produto."),
  });

  const unitOptions = UNITS.includes(unit as (typeof UNITS)[number]) ? [...UNITS] : [unit, ...UNITS];

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="pd-name">Nome</Label>
          <Input id="pd-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Leite integral" autoFocus />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pd-cat">Categoria</Label>
            <Input id="pd-cat" list="pd-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: Laticínios" />
            <datalist id="pd-categories">
              {(categories.data ?? []).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Unidade de medida</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger aria-label="Unidade de medida">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!item ? (
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as ItemType)}>
                <SelectTrigger aria-label="Tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...STOCK_TYPES, ...EPI_TYPES].map((t) => (
                    <SelectItem key={t} value={t}>
                      {ITEM_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="pd-min">Estoque mínimo</Label>
            <Input id="pd-min" inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd-cost">Custo por unidade</Label>
            <Input id="pd-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="R$ (opcional)" />
          </div>
          {!item ? (
            <div className="space-y-1.5">
              <Label htmlFor="pd-start">Quantidade atual</Label>
              <Input id="pd-start" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0" />
            </div>
          ) : null}
        </div>
        {item ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> Produto ativo nesta unidade
          </label>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

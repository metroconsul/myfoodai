import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { applyMovement, type MovementType } from "@/lib/stock.shared";
import { cn } from "@/lib/utils";
import { MOVEMENT_LABEL, parseNumber, qty } from "../lib/labels";
import { estoqueKey, useSuppliers, type StockItem } from "../lib/queries";

export type DialogType = Exclude<MovementType, "inventario">;
const TYPES: DialogType[] = ["entrada", "saida", "ajuste", "perda", "transferencia"];
const NONE = "nenhum";

/**
 * Janela de movimentação. Com `item` fixo (botões da lista de produtos) ou escolhendo o produto.
 * Ajuste: a pessoa informa o saldo correto e a tela envia a diferença.
 */
export function MovementDialog({
  open,
  onClose,
  items,
  item: fixedItem,
  type: initialType = "entrada",
}: {
  open: boolean;
  onClose: () => void;
  items: StockItem[];
  item?: StockItem | null;
  type?: DialogType;
}) {
  const { units, activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();
  const [type, setType] = useState<DialogType>(initialType);
  const [itemId, setItemId] = useState("");
  const [amount, setAmount] = useState("");
  const [cost, setCost] = useState("");
  const [supplierId, setSupplierId] = useState(NONE);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Reinicia o formulário a cada abertura.
  const key = open ? `${fixedItem?.id ?? ""}|${initialType}` : null;
  if (key !== openKey) {
    setOpenKey(key);
    setType(initialType);
    setItemId(fixedItem?.id ?? "");
    setAmount("");
    setCost("");
    setSupplierId(NONE);
    setTarget("");
    setReason("");
  }

  const item = fixedItem ?? items.find((i) => i.id === itemId) ?? null;
  const n = parseNumber(amount);
  const current = Number(item?.quantity ?? 0);
  const valid = Boolean(item) && Number.isFinite(n) && (type === "ajuste" ? n >= 0 && n !== current : n > 0) && (type !== "transferencia" || target);
  const after = !item || !Number.isFinite(n) ? null : type === "entrada" ? current + n : type === "ajuste" ? n : current - n;

  const save = useMutation({
    mutationFn: async () => {
      const c = parseNumber(cost);
      const res = await applyMovement(supabase, {
        itemId: item!.id,
        type,
        quantity: type === "ajuste" ? n - current : n,
        unitCost: type === "entrada" && Number.isFinite(c) ? c : null,
        supplierId: type === "entrada" && supplierId !== NONE ? supplierId : null,
        targetUnitId: type === "transferencia" ? target : null,
        reason: reason.trim() || null,
      });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: (r) => {
      toast.success(`${MOVEMENT_LABEL[type]} registrada. Saldo agora: ${qty(r.after)} ${item!.unit_of_measure}.`);
      void queryClient.invalidateQueries({ queryKey: estoqueKey });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível registrar."),
  });

  const otherUnits = units.filter((u) => u.id !== activeUnitId);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fixedItem ? fixedItem.name : "Nova movimentação"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo">
          {TYPES.filter((t) => t !== "transferencia" || otherUnits.length > 0).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-[8px] border-2 border-foreground px-3 py-1.5 text-sm font-semibold",
                type === t ? "bg-accent shadow-[2px_2px_0_var(--ink)]" : "bg-card",
              )}
            >
              {MOVEMENT_LABEL[t]}
            </button>
          ))}
        </div>

        {!fixedItem ? (
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger aria-label="Produto">
                <SelectValue placeholder="Escolha o produto" />
              </SelectTrigger>
              <SelectContent>
                {items
                  .filter((i) => i.active)
                  .map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} · {qty(i.quantity)} {i.unit_of_measure}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="mv-amount">{type === "ajuste" ? "Saldo correto" : "Quantidade"}</Label>
            <div className="flex items-center gap-2">
              <Input id="mv-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32" autoFocus />
              <span className="text-sm text-muted-foreground">{item?.unit_of_measure ?? ""}</span>
            </div>
          </div>
          {type === "entrada" ? (
            <div className="space-y-1.5">
              <Label htmlFor="mv-cost">Custo por unidade (opcional)</Label>
              <Input id="mv-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="R$" className="w-32" />
            </div>
          ) : null}
        </div>

        {type === "entrada" && (suppliers.data ?? []).some((s) => s.active) ? (
          <div className="space-y-1.5">
            <Label>Fornecedor (opcional)</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger aria-label="Fornecedor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {(suppliers.data ?? [])
                  .filter((s) => s.active)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {type === "transferencia" ? (
          <div className="space-y-1.5">
            <Label>Para a unidade</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger aria-label="Unidade de destino">
                <SelectValue placeholder="Escolha a unidade" />
              </SelectTrigger>
              <SelectContent>
                {otherUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="mv-reason">Observação (opcional)</Label>
          <Input
            id="mv-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={type === "perda" ? "Ex.: vencido, quebrado" : type === "entrada" ? "Ex.: nota 123" : ""}
          />
        </div>

        {item && after != null ? (
          <p className={cn("text-sm", after < 0 ? "text-destructive" : "text-muted-foreground")}>
            Saldo: {qty(current)} → <strong>{qty(after)}</strong> {item.unit_of_measure}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Salvando…" : `Registrar ${MOVEMENT_LABEL[type].toLowerCase()}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

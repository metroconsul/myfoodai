import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrDateInput } from "@/components/ui/br-inputs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { brl } from "@/apps/estoque/lib/labels";
import { useSuppliers } from "@/apps/estoque/lib/queries";
import { cpdb } from "../lib/db";
import { lineValues, newKey, toText, type EditLine } from "../lib/lines";
import { comprasKey, useProducts, useStockForSuggestion } from "../lib/queries";
import { linesTotal, suggestLines } from "../lib/rules";
import { LineEditor } from "./line-editor";

/** Novo pedido: fornecedor, previsão de entrega e itens (com sugestão pelo estoque mínimo). */
export function NewOrderDialog({ open, onClose, suggest = false }: { open: boolean; onClose: () => void; suggest?: boolean }) {
  const { company, activeUnitId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();
  const products = useProducts(activeUnitId);
  const stock = useStockForSuggestion(activeUnitId);
  const [supplierId, setSupplierId] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  function suggestion(): EditLine[] {
    return suggestLines(stock.data ?? []).map((l) => ({ key: newKey(), catalogItemId: l.catalogItemId, qtyText: toText(l.quantity), priceText: toText(l.unitPrice) }));
  }

  // Reinicia ao abrir; com `suggest`, já vem com a sugestão.
  const key = open ? `aberto|${suggest}|${stock.isSuccess}` : null;
  if (key !== openKey) {
    setOpenKey(key);
    if (open) {
      setSupplierId("");
      setExpected("");
      setNotes("");
      setLines(suggest ? suggestion() : []);
    }
  }

  const values = lines.map(lineValues);
  const valid = Boolean(supplierId) && lines.length > 0 && values.every((v) => v.valid);

  const save = useMutation({
    mutationFn: async () => {
      const { data: order, error } = await cpdb
        .from("purchase_orders")
        .insert({ company_id: company!.id, unit_id: activeUnitId!, supplier_id: supplierId, expected_date: expected || null, notes: notes.trim() || null })
        .select("id")
        .single();
      if (error || !order) throw error ?? new Error("Não foi possível criar o pedido.");
      const { error: e2 } = await cpdb.from("purchase_order_items").insert(
        lines.map((l, i) => ({ order_id: order.id, catalog_item_id: l.catalogItemId, quantity: values[i]!.quantity, unit_price: values[i]!.price })),
      );
      if (e2) throw e2;
      return order.id;
    },
    onSuccess: (id) => {
      toast.success("Pedido criado. Agora é só enviar pelo WhatsApp.");
      void queryClient.invalidateQueries({ queryKey: comprasKey });
      onClose();
      void navigate({ to: "/compras/pedidos/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar o pedido."),
  });

  const activeSuppliers = (suppliers.data ?? []).filter((s) => s.active);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            {activeSuppliers.length === 0 ? (
              <p className="text-sm">
                Nenhum fornecedor.{" "}
                <Link to="/compras/fornecedores" className="font-semibold underline" onClick={onClose}>
                  Cadastrar
                </Link>
              </p>
            ) : (
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-56" aria-label="Fornecedor">
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {activeSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-date">Entrega prevista</Label>
            <BrDateInput id="po-date" value={expected} onChange={setExpected} />
          </div>
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="po-notes">Observação</Label>
            <Input id="po-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label>Itens</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const s = suggestion();
              if (s.length === 0) toast.info("Nenhum produto abaixo do mínimo nesta unidade.");
              else setLines(s);
            }}
          >
            <Sparkles className="mr-2 size-4" aria-hidden /> Sugerir pelo estoque mínimo
          </Button>
        </div>
        <LineEditor lines={lines} onChange={setLines} products={products.data ?? []} />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <span className="text-sm">
            Total estimado: <strong>{brl(linesTotal(values.filter((v) => v.valid).map((v) => ({ quantity: v.quantity, unitPrice: v.price }))))}</strong>
          </span>
          <span className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Criando…" : "Criar pedido"}
            </Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { BrDateInput } from "@/components/ui/br-inputs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { localYmd } from "@/lib/local-date";
import { brl } from "@/apps/estoque/lib/labels";
import { estoqueKey, useSuppliers } from "@/apps/estoque/lib/queries";
import { LineEditor } from "../components/line-editor";
import { cpdb } from "../lib/db";
import { lineValues, newKey, toText, type EditLine } from "../lib/lines";
import { comprasKey, useOrders, useProducts, type OrderWithItems } from "../lib/queries";
import { OPEN_STATUSES, linesTotal } from "../lib/rules";

const SEM_PEDIDO = "sem-pedido";

function linesFromOrder(o: OrderWithItems): EditLine[] {
  return o.items
    .map((i) => ({ i, remaining: Math.max(Number(i.quantity) - Number(i.received_quantity), 0) }))
    .filter((x) => x.remaining > 0)
    .map(({ i, remaining }) => ({
      key: newKey(),
      catalogItemId: i.catalog_item_id,
      qtyText: toText(remaining),
      priceText: toText(i.unit_price == null ? null : Number(i.unit_price)),
      orderItemId: i.id,
      ordered: Number(i.quantity),
    }));
}

/**
 * Receber compra: confira o que chegou e confirme. Ao confirmar, tudo entra no estoque da unidade
 * (uma operação só no banco; clique repetido não duplica).
 */
export function ReceberPage({ pedidoId }: { pedidoId?: string | undefined }) {
  const { activeUnitId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orders = useOrders(activeUnitId);
  const products = useProducts(activeUnitId);
  const suppliers = useSuppliers();
  const [source, setSource] = useState<string>(pedidoId ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [invoice, setInvoice] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(localYmd());
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [clientKey, setClientKey] = useState(() => newKey());
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const open = (orders.data ?? []).filter((o) => OPEN_STATUSES.includes(o.status));
  const order = open.find((o) => o.id === source) ?? null;
  // Ao escolher um pedido, preenche com o que falta chegar.
  if (order && loadedFor !== order.id) {
    setLoadedFor(order.id);
    setLines(linesFromOrder(order));
  }

  const values = lines.map(lineValues);
  const valid = Boolean(source) && lines.length > 0 && values.every((v) => v.valid);
  const total = linesTotal(values.filter((v) => v.valid).map((v) => ({ quantity: v.quantity, unitPrice: v.price })));

  const receive = useMutation({
    mutationFn: async () => {
      const { data, error } = await cpdb.rpc("purchase_receive", {
        _unit_id: activeUnitId!,
        _supplier_id: order ? null : supplierId || null,
        _order_id: order?.id ?? null,
        _lines: lines.map((l, i) => ({ catalog_item_id: l.catalogItemId, quantity: values[i]!.quantity, unit_cost: values[i]!.price, order_item_id: l.orderItemId ?? null })),
        _invoice_number: invoice.trim() || null,
        _invoice_date: invoiceDate || null,
        _due_date: due || null,
        _notes: notes.trim() || null,
        _client_key: clientKey,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success(`Compra recebida: ${lines.length} produto(s) entraram no estoque.`);
      setClientKey(newKey());
      void queryClient.invalidateQueries({ queryKey: comprasKey });
      void queryClient.invalidateQueries({ queryKey: estoqueKey });
      void navigate({ to: "/compras/historico" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível receber."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;
  if (orders.isLoading || products.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader title="Receber compra" description="Confira o que chegou e confirme. Tudo entra no estoque na hora." />
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>O que chegou</Label>
            <Select
              value={source}
              onValueChange={(v) => {
                setSource(v);
                setLoadedFor(null);
                if (v === SEM_PEDIDO) setLines([]);
              }}
            >
              <SelectTrigger className="w-72" aria-label="Pedido">
                <SelectValue placeholder="Escolha o pedido" />
              </SelectTrigger>
              <SelectContent>
                {open.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    Pedido nº {o.number} · {(suppliers.data ?? []).find((s) => s.id === o.supplier_id)?.name ?? "Fornecedor"}
                  </SelectItem>
                ))}
                <SelectItem value={SEM_PEDIDO}>Compra sem pedido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {source === SEM_PEDIDO ? (
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-56" aria-label="Fornecedor">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
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
        </div>
      </SectionCard>

      {source ? (
        <>
          <SectionCard title="Produtos recebidos">
            {order ? <p className="mb-3 text-sm text-muted-foreground">Já vem com o que falta chegar do pedido. Ajuste se veio diferente; remova o que não veio.</p> : null}
            <LineEditor lines={lines} onChange={setLines} products={products.data ?? []} priceLabel="Custo por unidade" fixedProducts={Boolean(order)} />
          </SectionCard>
          <SectionCard title="Nota e pagamento">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rc-nf">Nº da nota</Label>
                <Input id="rc-nf" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Opcional" className="w-36" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-date">Data da nota</Label>
                <BrDateInput id="rc-date" value={invoiceDate} onChange={setInvoiceDate} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-due">Vencimento</Label>
                <BrDateInput id="rc-due" value={due} onChange={setDue} />
              </div>
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor="rc-notes">Observação</Label>
                <Input id="rc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </SectionCard>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm">
              Total: <strong>{brl(total)}</strong>
            </span>
            <Button disabled={!valid || receive.isPending} onClick={() => receive.mutate()}>
              <PackageCheck className="mr-2 size-4" aria-hidden /> {receive.isPending ? "Registrando…" : "Confirmar recebimento"}
            </Button>
          </div>
        </>
      ) : null}
    </>
  );
}

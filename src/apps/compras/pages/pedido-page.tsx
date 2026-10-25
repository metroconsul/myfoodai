import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, MessageCircle, PackageCheck } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { dateFmt } from "@/lib/format";
import { brl, qty } from "@/apps/estoque/lib/labels";
import { useSuppliers } from "@/apps/estoque/lib/queries";
import { LineEditor } from "../components/line-editor";
import { cpdb } from "../lib/db";
import { lineValues, newKey, toText, type EditLine } from "../lib/lines";
import { comprasKey, useOrders, useProducts } from "../lib/queries";
import { STATUS_LABEL, STATUS_TONE, linesTotal, orderMessage, whatsappLink } from "../lib/rules";

/** Um pedido: itens (editáveis enquanto não recebido), enviar pelo WhatsApp, receber, cancelar. */
export function PedidoPage({ id }: { id: string }) {
  const { activeUnitId, company, activeUnit } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orders = useOrders(activeUnitId);
  const products = useProducts(activeUnitId);
  const suppliers = useSuppliers();
  const order = (orders.data ?? []).find((o) => o.id === id);
  const supplier = (suppliers.data ?? []).find((s) => s.id === order?.supplier_id);
  const [lines, setLines] = useState<EditLine[] | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: comprasKey });
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");

  const setStatus = useMutation({
    mutationFn: async (status: "enviado" | "cancelado") => {
      const { error } = await cpdb.from("purchase_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: fail,
  });

  const saveItems = useMutation({
    mutationFn: async (edited: EditLine[]) => {
      const current = order!.items;
      const keep = new Set(edited.map((l) => l.orderItemId).filter(Boolean));
      const removed = current.filter((i) => !keep.has(i.id) && Number(i.received_quantity) === 0).map((i) => i.id);
      if (removed.length) {
        const { error } = await cpdb.from("purchase_order_items").delete().in("id", removed);
        if (error) throw error;
      }
      for (const l of edited) {
        const v = lineValues(l);
        if (l.orderItemId) {
          const { error } = await cpdb.from("purchase_order_items").update({ quantity: v.quantity, unit_price: v.price }).eq("id", l.orderItemId);
          if (error) throw error;
        } else {
          const { error } = await cpdb.from("purchase_order_items").insert({ order_id: id, catalog_item_id: l.catalogItemId, quantity: v.quantity, unit_price: v.price });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Pedido atualizado.");
      setLines(null);
      void refresh();
    },
    onError: fail,
  });

  if (orders.isLoading || products.isLoading) return <LoadingState />;
  if (!order) return <EmptyState title="Pedido não encontrado nesta unidade" />;

  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));
  const editable = order.status === "aberto" || order.status === "enviado";
  const items = order.items.map((i) => ({ ...i, product: productById.get(i.catalog_item_id) }));
  const message = orderMessage({
    number: order.number,
    supplier: supplier?.contact_name || supplier?.name || "fornecedor",
    company: company?.name ?? "",
    unit: activeUnit?.name ?? "",
    expectedDate: order.expected_date,
    notes: order.notes,
    items: items.map((i) => ({ name: i.product?.name ?? "Produto", unit: i.product?.unit ?? "", quantity: Number(i.quantity) })),
  });
  const total = linesTotal(order.items.map((i) => ({ quantity: Number(i.quantity), unitPrice: i.unit_price == null ? null : Number(i.unit_price) })));

  function sendWhatsapp() {
    window.open(whatsappLink(supplier?.phone, message), "_blank", "noopener,noreferrer");
    if (order!.status === "aberto") setStatus.mutate("enviado");
  }

  return (
    <>
      <Link to="/compras/pedidos" className="inline-flex items-center gap-1 text-sm font-semibold underline">
        <ArrowLeft className="size-4" aria-hidden /> Pedidos
      </Link>
      <PageHeader
        title={`Pedido nº ${order.number}`}
        description={`${supplier?.name ?? "Fornecedor"} · criado em ${dateFmt(order.created_at)}${order.expected_date ? ` · entrega ${dateFmt(`${order.expected_date}T12:00:00`)}` : ""}`}
        actions={<StatusBadge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</StatusBadge>}
      />

      {order.status !== "cancelado" && order.status !== "recebido" ? (
        <SectionCard>
          <div className="flex flex-wrap gap-2">
            <Button onClick={sendWhatsapp}>
              <MessageCircle className="mr-2 size-4" aria-hidden /> {order.status === "aberto" ? "Enviar pelo WhatsApp" : "Reenviar pelo WhatsApp"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(message).then(() => toast.success("Texto do pedido copiado."));
              }}
            >
              <Copy className="mr-2 size-4" aria-hidden /> Copiar texto
            </Button>
            <Button variant="outline" onClick={() => void navigate({ to: "/compras/receber", search: { pedido: order.id } })}>
              <PackageCheck className="mr-2 size-4" aria-hidden /> Receber
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Cancelar o pedido nº ${order.number}?`)) setStatus.mutate("cancelado");
              }}
            >
              Cancelar pedido
            </Button>
          </div>
          {!supplier?.phone ? (
            <p className="mt-2 text-sm text-muted-foreground">
              O fornecedor não tem telefone cadastrado: o WhatsApp abre para você escolher o contato.{" "}
              <Link to="/compras/fornecedores" className="font-semibold underline">
                Cadastrar telefone
              </Link>
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title={`Itens · ${brl(total)}`}
        action={
          editable && !lines ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setLines(order.items.map((i) => ({ key: newKey(), catalogItemId: i.catalog_item_id, qtyText: toText(Number(i.quantity)), priceText: toText(i.unit_price == null ? null : Number(i.unit_price)), orderItemId: i.id })))
              }
            >
              Editar itens
            </Button>
          ) : null
        }
      >
        {lines ? (
          <>
            <LineEditor lines={lines} onChange={setLines} products={products.data ?? []} />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLines(null)}>
                Desistir
              </Button>
              <Button disabled={lines.length === 0 || !lines.every((l) => lineValues(l).valid) || saveItems.isPending} onClick={() => saveItems.mutate(lines)}>
                Salvar itens
              </Button>
            </div>
          </>
        ) : (
          <ul className="divide-y divide-foreground/15">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{i.product?.name ?? "Produto"}</span>
                  <span className="meta-mono">
                    pedido {qty(i.quantity)} {i.product?.unit ?? ""}
                    {Number(i.received_quantity) > 0 ? ` · recebido ${qty(i.received_quantity)}` : ""}
                    {i.unit_price != null ? ` · ${brl(i.unit_price)} cada` : ""}
                  </span>
                </span>
                <span className="font-semibold">{i.unit_price != null ? brl(Number(i.quantity) * Number(i.unit_price)) : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Mensagem do pedido">
        <pre className="whitespace-pre-wrap rounded-[10px] bg-secondary p-3 text-sm">{message}</pre>
      </SectionCard>
    </>
  );
}

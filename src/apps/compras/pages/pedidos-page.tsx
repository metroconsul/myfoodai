import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { dateFmt } from "@/lib/format";
import { brl } from "@/apps/estoque/lib/labels";
import { useSuppliers } from "@/apps/estoque/lib/queries";
import { NewOrderDialog } from "../components/new-order-dialog";
import { useOrders } from "../lib/queries";
import { OPEN_STATUSES, STATUS_LABEL, STATUS_TONE, linesTotal } from "../lib/rules";


/** Pedidos da unidade: em aberto primeiro; novo pedido com sugestão pelo estoque mínimo. */
export function PedidosPage() {
  const { activeUnitId } = useWorkspace();
  const orders = useOrders(activeUnitId);
  const suppliers = useSuppliers();
  const [creating, setCreating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const supplierName = new Map((suppliers.data ?? []).map((s) => [s.id, s.name]));

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;
  const list = (orders.data ?? []).filter((o) => showAll || OPEN_STATUSES.includes(o.status));

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Monte o pedido, envie pelo WhatsApp e, quando chegar, receba."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 size-4" aria-hidden /> Novo pedido
          </Button>
        }
      />
      <SectionCard
        title={showAll ? "Todos os pedidos" : "Pedidos em aberto"}
        action={
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showAll} onCheckedChange={setShowAll} /> Mostrar recebidos e cancelados
          </label>
        }
      >
        {orders.isLoading ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState title={showAll ? "Nenhum pedido" : "Nenhum pedido em aberto"} description="Crie um pedido em “Novo pedido”." />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {list.map((o) => (
              <li key={o.id}>
                <Link to="/compras/pedidos/$id" params={{ id: o.id }} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm hover:bg-secondary">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      Pedido nº {o.number} · {supplierName.get(o.supplier_id) ?? "Fornecedor"}
                    </span>
                    <span className="meta-mono">
                      {o.items.length} item(ns) · criado em {dateFmt(o.created_at)}
                      {o.expected_date ? ` · entrega ${dateFmt(`${o.expected_date}T12:00:00`)}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold">{brl(linesTotal(o.items.map((i) => ({ quantity: Number(i.quantity), unitPrice: i.unit_price == null ? null : Number(i.unit_price) }))))}</span>
                    <StatusBadge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</StatusBadge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <NewOrderDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

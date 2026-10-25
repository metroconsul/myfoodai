import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ClipboardList, PackageCheck, Truck, Wallet } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { dateFmt, dateTimeFmt } from "@/lib/format";
import { localYmd } from "@/lib/local-date";
import { brl } from "@/apps/estoque/lib/labels";
import { useSuppliers } from "@/apps/estoque/lib/queries";
import { NewOrderDialog } from "../components/new-order-dialog";
import { useOrders, useReceipts, useStockForSuggestion } from "../lib/queries";
import { OPEN_STATUSES, STATUS_LABEL, STATUS_TONE, suggestLines } from "../lib/rules";

/** Visão geral das compras da unidade: pedidos em aberto, entregas, gasto do mês e o que está acabando. */
export function ComprasDashboardPage() {
  const { activeUnitId, activeUnit } = useWorkspace();
  const today = localYmd();
  const monthStart = `${today.slice(0, 8)}01`;
  const orders = useOrders(activeUnitId);
  const receipts = useReceipts(activeUnitId, monthStart, today);
  const stock = useStockForSuggestion(activeUnitId);
  const suppliers = useSuppliers();
  const [suggesting, setSuggesting] = useState(false);
  const supplierName = new Map((suppliers.data ?? []).map((s) => [s.id, s.name]));

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;
  if (orders.isLoading || receipts.isLoading) return <LoadingState />;

  const open = (orders.data ?? []).filter((o) => OPEN_STATUSES.includes(o.status));
  const late = open.filter((o) => o.expected_date && o.expected_date < today);
  const dueToday = open.filter((o) => o.expected_date === today);
  const spent = (receipts.data ?? []).filter((r) => r.status === "confirmado").reduce((acc, r) => acc + Number(r.total_amount), 0);
  const low = suggestLines(stock.data ?? []);

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={activeUnit?.name ?? ""}
        actions={
          <Button asChild variant="outline">
            <Link to="/compras/receber">
              <PackageCheck className="mr-2 size-4" aria-hidden /> Receber compra
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pedidos em aberto" value={open.length} icon={<ClipboardList className="size-5" />} />
        <StatCard label="Entregas hoje" value={dueToday.length} hint={late.length ? `${late.length} atrasada(s)` : "Nenhuma atrasada"} icon={<Truck className="size-5" />} tone={late.length ? "warning" : "default"} />
        <StatCard label="Comprado no mês" value={brl(spent)} icon={<Wallet className="size-5" />} />
        <StatCard label="Para comprar" value={low.length} hint="Abaixo do mínimo" icon={<AlertTriangle className="size-5" />} tone={low.length ? "warning" : "success"} />
      </div>

      {low.length > 0 ? (
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{low.length} produto(s)</strong> estão no mínimo ou abaixo. O pedido já sai com as quantidades sugeridas.
            </p>
            <Button onClick={() => setSuggesting(true)}>Criar pedido com sugestão</Button>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Pedidos em aberto"
          action={
            <Link to="/compras/pedidos" className="text-sm font-semibold underline">
              Ver pedidos
            </Link>
          }
        >
          {open.length === 0 ? (
            <EmptyState title="Nenhum pedido em aberto" />
          ) : (
            <ul className="divide-y divide-foreground/15">
              {open.slice(0, 8).map((o) => (
                <li key={o.id}>
                  <Link to="/compras/pedidos/$id" params={{ id: o.id }} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-secondary">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        Nº {o.number} · {supplierName.get(o.supplier_id) ?? "Fornecedor"}
                      </span>
                      <span className="meta-mono">{o.expected_date ? `entrega ${dateFmt(`${o.expected_date}T12:00:00`)}` : "sem data de entrega"}</span>
                    </span>
                    <StatusBadge tone={o.expected_date && o.expected_date < today ? "danger" : STATUS_TONE[o.status]}>
                      {o.expected_date && o.expected_date < today ? "Atrasado" : STATUS_LABEL[o.status]}
                    </StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard
          title="Últimas compras recebidas"
          action={
            <Link to="/compras/historico" className="text-sm font-semibold underline">
              Ver histórico
            </Link>
          }
        >
          {(receipts.data ?? []).length === 0 ? (
            <EmptyState title="Nada recebido neste mês" />
          ) : (
            <ul className="divide-y divide-foreground/15">
              {(receipts.data ?? []).slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.supplier_id ? (supplierName.get(r.supplier_id) ?? "Fornecedor") : "Sem fornecedor"}</span>
                    <span className="meta-mono">{dateTimeFmt(r.received_at)}</span>
                  </span>
                  <span className={r.status === "cancelado" ? "font-semibold text-muted-foreground line-through" : "font-semibold"}>{brl(r.total_amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
      <NewOrderDialog open={suggesting} suggest onClose={() => setSuggesting(false)} />
    </>
  );
}

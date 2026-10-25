import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Boxes, Wallet } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/ui-kit";
import { useWorkspace } from "@/hooks/use-workspace";
import { dateTimeFmt } from "@/lib/format";
import { daysAgoYmd, localYmd } from "@/lib/local-date";
import { MOVEMENT_LABEL, brl, isLow, movementSign, qty } from "../lib/labels";
import { useAlerts, useMovements, useStockItems, type Movement } from "../lib/queries";
import { stockValue } from "../lib/reports";

const RECENT_DAYS = 30;

/** Visão geral da unidade ativa: números, alertas, entradas e saídas recentes. */
export function EstoqueDashboardPage() {
  const { activeUnitId, activeUnit } = useWorkspace();
  const items = useStockItems(activeUnitId);
  const alerts = useAlerts(activeUnitId);
  const movs = useMovements(activeUnitId, daysAgoYmd(RECENT_DAYS), localYmd(), 200);

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;
  if (items.isLoading || movs.isLoading) return <LoadingState />;

  const active = (items.data ?? []).filter((i) => i.active);
  const low = active.filter(isLow);
  const list = movs.data ?? [];
  const entradas = list.filter((m) => m.movement_type === "entrada").slice(0, 6);
  const saidas = list.filter((m) => ["saida", "perda", "transferencia"].includes(m.movement_type)).slice(0, 6);
  const names = new Map(active.map((i) => [i.id, i.name]));

  return (
    <>
      <PageHeader title="Visão geral" description={activeUnit?.name ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Produtos cadastrados" value={active.length} icon={<Boxes className="size-5" />} />
        <StatCard label="Com estoque baixo" value={low.length} icon={<AlertTriangle className="size-5" />} tone={low.length ? "warning" : "success"} />
        <StatCard label="Alertas abertos" value={(alerts.data ?? []).length} tone={(alerts.data ?? []).length ? "warning" : "success"} />
        <StatCard label="Valor em estoque" value={brl(stockValue(active))} hint="Pelo custo informado" icon={<Wallet className="size-5" />} />
      </div>

      <SectionCard
        title="Alertas de estoque"
        action={
          low.length ? (
            <Link to="/estoque/produtos" className="text-sm font-semibold underline">
              Ver produtos
            </Link>
          ) : null
        }
      >
        {(alerts.data ?? []).length === 0 ? (
          <EmptyState title="Nenhum alerta" description="Tudo acima do estoque mínimo." />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {(alerts.data ?? []).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{names.get(a.inventory_item_id) ?? "Produto"}</span>
                  <span className="meta-mono">{a.message}</span>
                </span>
                <StatusBadge tone={a.alert_type === "sem_estoque" ? "danger" : "warn"}>
                  {a.alert_type === "sem_estoque" ? "Sem estoque" : "Abaixo do mínimo"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <MovementList title="Entradas recentes" icon={<ArrowUpCircle className="size-4" />} list={entradas} />
        <MovementList title="Saídas recentes" icon={<ArrowDownCircle className="size-4" />} list={saidas} />
      </div>

      <MovementList
        title="Últimas movimentações"
        list={list.slice(0, 10)}
        action={
          <Link to="/estoque/movimentacoes" className="text-sm font-semibold underline">
            Ver histórico
          </Link>
        }
      />
    </>
  );
}

function MovementList({ title, list, icon, action }: { title: string; list: Movement[]; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <SectionCard title={title} action={action}>
      {list.length === 0 ? (
        <EmptyState title="Nada nos últimos 30 dias" />
      ) : (
        <ul className="divide-y divide-foreground/15">
          {list.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {icon}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.inventory_items?.name ?? "Produto"}</span>
                  <span className="meta-mono">
                    {MOVEMENT_LABEL[m.movement_type]} · {dateTimeFmt(m.occurred_at)}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </span>
                </span>
              </span>
              <span className="whitespace-nowrap font-semibold">
                {movementSign(m.movement_type) === "=" ? "= " : movementSign(m.movement_type) === "+" && Number(m.quantity) >= 0 ? "+ " : "− "}
                {qty(Math.abs(Number(m.quantity)))} {m.inventory_items?.unit_of_measure ?? ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { MercadoPagoCard } from "../components/mercado-pago-card";
import { cfdb } from "../lib/db";
import { useCfRoles, usePaymentMethods } from "../lib/hooks";
import { fmtDateTime, localDayStartIso } from "../lib/dates";
import { PERIOD_LABEL, addDays, formatBRL, periodRange, sumMoney, type PeriodKey } from "../lib/money";

/** Vendas registradas no caixa + vendas importadas do Mercado Pago. */
export function VendasPage() {
  const { units } = useWorkspace();
  const { canFinance } = useCfRoles();
  const [period, setPeriod] = useState<PeriodKey>("today");
  const range = periodRange(period);
  const methods = usePaymentMethods();
  const methodName = new Map((methods.data ?? []).map((m) => [m.id, m.name]));
  const unitName = new Map(units.map((u) => [u.id, u.name]));

  const sales = useQuery({
    queryKey: ["cf", "sales", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await cfdb
        .from("cash_movements")
        .select("*")
        .eq("type", "sale")
        .gte("created_at", localDayStartIso(range.from))
        .lt("created_at", localDayStartIso(addDays(range.to, 1)))
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  // Vendas importadas do Mercado Pago (sales_orders da conexão da empresa), no mesmo período.
  const mpOrders = useQuery({
    queryKey: ["cf", "mp-sales", range.from, range.to],
    queryFn: async () => {
      const { data: conn } = await supabase
        .from("sales_connections")
        .select("id")
        .eq("provider", "mercado_pago")
        .maybeSingle();
      if (!conn) return [];
      const { data, error } = await supabase
        .from("sales_orders")
        .select("id, unit_id, channel, ordered_at, gross_amount, is_cancelled")
        .eq("connection_id", conn.id)
        .gte("ordered_at", localDayStartIso(range.from))
        .lt("ordered_at", localDayStartIso(addDays(range.to, 1)))
        .order("ordered_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  // Uma lista só: vendas do caixa (sem as estornadas) + vendas do Mercado Pago (estornadas aparecem riscadas).
  const cash = sales.data ?? [];
  const reversed = new Set(cash.filter((m) => m.reversal_of).map((m) => m.reversal_of!));
  const rows: SaleRow[] = [
    ...cash
      .filter((m) => !m.reversal_of && !reversed.has(m.id))
      .map((m) => ({
        id: m.id,
        title: `${methodName.get(m.payment_method_id) ?? "Venda"}${m.description ? ` · ${m.description}` : ""}`,
        at: m.created_at,
        unitId: m.unit_id,
        amount: Number(m.amount),
        cancelled: false,
      })),
    ...(mpOrders.data ?? []).map((o) => ({
      id: o.id,
      title: `${o.channel ?? "Mercado Pago"}${o.is_cancelled ? " · estornada" : ""}`,
      at: o.ordered_at,
      unitId: o.unit_id,
      amount: Number(o.gross_amount),
      cancelled: o.is_cancelled,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const valid = rows.filter((r) => !r.cancelled);
  const total = sumMoney(valid.map((r) => r.amount));
  const count = valid.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description="Vendas do caixa e do Mercado Pago no período."
        actions={
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-44" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total vendido" value={formatBRL(total)} hint={PERIOD_LABEL[period]} icon={<Receipt className="size-5" />} tone="success" />
        <StatCard label="Vendas" value={String(count)} hint="Sem contar as estornadas" icon={<ShoppingBag className="size-5" />} />
        <StatCard label="Ticket médio" value={formatBRL(count > 0 ? total / count : 0)} icon={<TrendingUp className="size-5" />} />
      </div>

      {canFinance ? <MercadoPagoCard /> : null}

      <SectionCard title="Vendas">
        {sales.isLoading || mpOrders.isLoading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhuma venda no período"
            description="As vendas aparecem aqui assim que são registradas no caixa ou recebidas pelo Mercado Pago."
          />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {rows.slice(0, 300).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{r.title}</span>
                  <span className="meta-mono">
                    {fmtDateTime(r.at)} · {unitName.get(r.unitId) ?? ""}
                  </span>
                </span>
                <span className={r.cancelled ? "font-semibold line-through text-muted-foreground" : "font-semibold"}>
                  {formatBRL(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

type SaleRow = { id: string; title: string; at: string; unitId: string; amount: number; cancelled: boolean };

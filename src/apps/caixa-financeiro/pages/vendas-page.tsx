import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { cfdb } from "../lib/db";
import { usePaymentMethods } from "../lib/hooks";
import { fmtDateTime, localDayStartIso } from "../lib/dates";
import { PERIOD_LABEL, addDays, formatBRL, periodRange, sumMoney, type PeriodKey } from "../lib/money";
import { SalesPage } from "./sales-page";

/** Vendas registradas no caixa (todas as empresas) + vendas importadas do PDV (recurso do plano Equipe). */
export function VendasPage() {
  const { hasFeature, units } = useWorkspace();
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

  const list = sales.data ?? [];
  const reversed = new Set(list.filter((m) => m.reversal_of).map((m) => m.reversal_of!));
  const valid = list.filter((m) => !m.reversal_of && !reversed.has(m.id));
  const total = sumMoney(valid.map((m) => m.amount));
  const count = valid.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description="Vendas registradas no caixa no período."
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

      <SectionCard title="Vendas no caixa">
        {sales.isLoading ? (
          <LoadingState />
        ) : valid.length === 0 ? (
          <EmptyState title="Nenhuma venda no período" description="As vendas aparecem aqui assim que são registradas no caixa." />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {valid.slice(0, 200).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {methodName.get(m.payment_method_id) ?? "Venda"}
                    {m.description ? ` · ${m.description}` : ""}
                  </span>
                  <span className="meta-mono">
                    {fmtDateTime(m.created_at)} · {unitName.get(m.unit_id) ?? ""}
                  </span>
                </span>
                <span className="font-semibold">{formatBRL(m.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {hasFeature("sales") ? (
        <section aria-label="Vendas importadas do PDV" className="border-t-2 border-foreground pt-6">
          <SalesPage />
        </section>
      ) : null}
    </div>
  );
}

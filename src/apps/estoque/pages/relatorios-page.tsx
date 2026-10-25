import { useState } from "react";
import { Download } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { BrDateInput } from "@/components/ui/br-inputs";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/use-workspace";
import { downloadCsv, toCsv } from "@/lib/csv";
import { dateFmt } from "@/lib/format";
import { daysAgoYmd, localYmd } from "@/lib/local-date";
import { brl, qty } from "../lib/labels";
import { useMovements, useStockItems } from "../lib/queries";
import { consumption, staleItems, stockValue } from "../lib/reports";

const STALE_DAYS = 30;

/** Relatórios: posição valorizada, consumo por período e produtos parados. Tudo vira planilha. */
export function RelatoriosPage() {
  const { activeUnitId, activeUnit } = useWorkspace();
  const items = useStockItems(activeUnitId);
  const [from, setFrom] = useState(daysAgoYmd(30));
  const [to, setTo] = useState(localYmd());
  const movs = useMovements(activeUnitId, from, to, 5000);

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;
  if (items.isLoading) return <LoadingState />;

  const active = (items.data ?? []).filter((i) => i.active);
  const total = stockValue(active);
  const used = consumption(movs.data ?? [], active);
  const stale = staleItems(active, STALE_DAYS);
  const unit = activeUnit?.name ?? "unidade";

  return (
    <>
      <PageHeader title="Relatórios" description={unit} />

      <SectionCard
        title={`Posição do estoque · ${brl(total)}`}
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={active.length === 0}
            onClick={() =>
              downloadCsv(
                `posicao-estoque-${localYmd()}.csv`,
                toCsv(
                  ["Produto", "Categoria", "Quantidade", "Unidade", "Mínimo", "Custo unitário", "Valor"],
                  active.map((i) => [i.name, i.category ?? "", qty(i.quantity), i.unit_of_measure, qty(i.minimum_stock), i.unit_cost != null ? brl(i.unit_cost) : "", brl(Math.max(0, Number(i.quantity)) * Number(i.unit_cost ?? 0))]),
                ),
              )
            }
          >
            <Download className="mr-2 size-4" aria-hidden /> Planilha
          </Button>
        }
      >
        {active.length === 0 ? (
          <EmptyState title="Nenhum produto" />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {[...active]
              .sort((a, b) => Number(b.quantity) * Number(b.unit_cost ?? 0) - Number(a.quantity) * Number(a.unit_cost ?? 0))
              .slice(0, 15)
              .map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="truncate">
                    {i.name} <span className="meta-mono">{qty(i.quantity)} {i.unit_of_measure}</span>
                  </span>
                  <span className="font-semibold">{i.unit_cost != null ? brl(Math.max(0, Number(i.quantity)) * Number(i.unit_cost)) : "sem custo"}</span>
                </li>
              ))}
          </ul>
        )}
        {active.length > 15 ? <p className="mt-2 text-sm text-muted-foreground">Mostrando os 15 de maior valor. A planilha traz todos.</p> : null}
      </SectionCard>

      <SectionCard
        title="Consumo no período"
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={used.length === 0}
            onClick={() =>
              downloadCsv(
                `consumo-${from}-a-${to}.csv`,
                toCsv(["Produto", "Saídas", "Perdas", "Total", "Unidade", "Valor pelo custo"], used.map((u) => [u.name, qty(u.saida), qty(u.perda), qty(u.total), u.unit, brl(u.value)])),
              )
            }
          >
            <Download className="mr-2 size-4" aria-hidden /> Planilha
          </Button>
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rel-from">De</Label>
            <BrDateInput id="rel-from" value={from} onChange={setFrom} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-to">Até</Label>
            <BrDateInput id="rel-to" value={to} onChange={setTo} />
          </div>
        </div>
        {movs.isLoading ? (
          <LoadingState />
        ) : used.length === 0 ? (
          <EmptyState title="Sem saídas ou perdas no período" />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {used.slice(0, 15).map((u) => (
              <li key={u.id} className="flex justify-between gap-3 py-2 text-sm">
                <span className="truncate">
                  {u.name}
                  {u.perda > 0 ? <span className="meta-mono"> · perdas {qty(u.perda)}</span> : null}
                </span>
                <span className="font-semibold">
                  {qty(u.total)} {u.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={`Parados há ${STALE_DAYS} dias ou mais`}>
        {stale.length === 0 ? (
          <EmptyState title="Nenhum produto parado" />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {stale.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
                <span className="truncate">
                  {i.name} <span className="meta-mono">{qty(i.quantity)} {i.unit_of_measure}</span>
                </span>
                <span className="meta-mono">{i.last_movement_at ? `última em ${dateFmt(i.last_movement_at)}` : "nunca movimentado"}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

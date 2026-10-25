import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { BrDateInput } from "@/components/ui/br-inputs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { downloadCsv, toCsv } from "@/lib/csv";
import { dateTimeFmt } from "@/lib/format";
import { daysAgoYmd, localYmd } from "@/lib/local-date";
import type { MovementType } from "@/lib/stock.shared";
import { MovementDialog } from "../components/movement-dialog";
import { MOVEMENT_LABEL, brl, qty } from "../lib/labels";
import { useMovements, useStockItems } from "../lib/queries";

const ALL = "todos";

/** Histórico de movimentações (só leitura) com filtros e planilha. Correções são feitas com um novo ajuste. */
export function MovimentacoesPage() {
  const { activeUnitId, units } = useWorkspace();
  const [from, setFrom] = useState(daysAgoYmd(30));
  const [to, setTo] = useState(localYmd());
  const [type, setType] = useState<string>(ALL);
  const [itemId, setItemId] = useState(ALL);
  const [creating, setCreating] = useState(false);
  const items = useStockItems(activeUnitId);
  const movs = useMovements(activeUnitId, from, to);
  const unitName = new Map(units.map((u) => [u.id, u.name]));

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;
  const list = (movs.data ?? []).filter((m) => (type === ALL || m.movement_type === type) && (itemId === ALL || m.inventory_item_id === itemId));

  function exportCsv() {
    downloadCsv(
      `movimentacoes-${from}-a-${to}.csv`,
      toCsv(
        ["Data e hora", "Produto", "Tipo", "Quantidade", "Unidade de medida", "Saldo antes", "Saldo depois", "Custo unitário", "Observação"],
        list.map((m) => [
          dateTimeFmt(m.occurred_at),
          m.inventory_items?.name ?? "",
          MOVEMENT_LABEL[m.movement_type],
          qty(m.quantity),
          m.inventory_items?.unit_of_measure ?? "",
          qty(m.quantity_before),
          qty(m.quantity_after),
          m.unit_cost != null ? brl(m.unit_cost) : "",
          m.reason ?? "",
        ]),
      ),
    );
  }

  return (
    <>
      <PageHeader
        title="Movimentações"
        description="Tudo o que entrou e saiu desta unidade. O histórico não pode ser editado; para corrigir, faça um ajuste."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 size-4" aria-hidden /> Nova movimentação
          </Button>
        }
      />
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mv-from">De</Label>
            <BrDateInput id="mv-from" value={from} onChange={setFrom} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-to">Até</Label>
            <BrDateInput id="mv-to" value={to} onChange={setTo} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-44" aria-label="Tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {MOVEMENT_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger className="w-56" aria-label="Produto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {(items.data ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" disabled={list.length === 0} onClick={exportCsv}>
            <Download className="mr-2 size-4" aria-hidden /> Baixar planilha
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={`Movimentações (${list.length})`}>
        {movs.isLoading ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState title="Nenhuma movimentação no período" />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {list.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {MOVEMENT_LABEL[m.movement_type]} · {m.inventory_items?.name ?? "Produto"}
                  </span>
                  <span className="meta-mono">
                    {dateTimeFmt(m.occurred_at)}
                    {m.movement_type === "transferencia" && m.target_unit_id ? ` · para ${unitName.get(m.target_unit_id) ?? "outra unidade"}` : ""}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">
                    {m.movement_type === "inventario" ? "contado " : ""}
                    {qty(m.quantity)} {m.inventory_items?.unit_of_measure ?? ""}
                  </span>
                  <span className="meta-mono">
                    saldo {qty(m.quantity_before)} → {qty(m.quantity_after)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <MovementDialog open={creating} items={items.data ?? []} onClose={() => setCreating(false)} />
    </>
  );
}

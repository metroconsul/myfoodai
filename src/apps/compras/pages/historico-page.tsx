import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Download, TrendingDown, TrendingUp } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { BrDateInput } from "@/components/ui/br-inputs";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/use-workspace";
import { downloadCsv, toCsv } from "@/lib/csv";
import { dateFmt, dateTimeFmt } from "@/lib/format";
import { daysAgoYmd, localYmd } from "@/lib/local-date";
import { brl, qty } from "@/apps/estoque/lib/labels";
import { estoqueKey, useSuppliers } from "@/apps/estoque/lib/queries";
import { cpdb } from "../lib/db";
import { comprasKey, useProducts, useReceipts } from "../lib/queries";
import { priceChanges } from "../lib/rules";

/** Compras recebidas no período, variação de preço e planilha. Cancelar devolve o estoque. */
export function HistoricoPage() {
  const { activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(daysAgoYmd(90));
  const [to, setTo] = useState(localYmd());
  const [openId, setOpenId] = useState<string | null>(null);
  const receipts = useReceipts(activeUnitId, from, to);
  const products = useProducts(activeUnitId);
  const suppliers = useSuppliers();
  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));
  const supplierName = new Map((suppliers.data ?? []).map((s) => [s.id, s.name]));

  const cancel = useMutation({
    mutationFn: async (v: { id: string; reason: string }) => {
      const { error } = await cpdb.rpc("purchase_cancel_receipt", { _receipt_id: v.id, _reason: v.reason || null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Recebimento cancelado. O estoque foi devolvido.");
      void queryClient.invalidateQueries({ queryKey: comprasKey });
      void queryClient.invalidateQueries({ queryKey: estoqueKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível cancelar."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;
  const list = receipts.data ?? [];
  const confirmed = list.filter((r) => r.status === "confirmado");
  const total = confirmed.reduce((acc, r) => acc + Number(r.total_amount), 0);
  const changes = priceChanges(
    confirmed.flatMap((r) => r.items.map((i) => ({ catalog_item_id: i.catalog_item_id, unit_cost: i.unit_cost == null ? null : Number(i.unit_cost), received_at: r.received_at }))),
  ).slice(0, 10);

  function exportCsv() {
    downloadCsv(
      `compras-${from}-a-${to}.csv`,
      toCsv(
        ["Recebido em", "Fornecedor", "Nota", "Vencimento", "Produto", "Quantidade", "Unidade", "Custo unitário", "Total da linha", "Situação"],
        list.flatMap((r) =>
          r.items.map((i) => {
            const p = productById.get(i.catalog_item_id);
            return [
              dateTimeFmt(r.received_at),
              r.supplier_id ? (supplierName.get(r.supplier_id) ?? "") : "",
              r.invoice_number ?? "",
              r.due_date ? dateFmt(`${r.due_date}T12:00:00`) : "",
              p?.name ?? "",
              qty(i.quantity),
              p?.unit ?? "",
              i.unit_cost != null ? brl(i.unit_cost) : "",
              i.unit_cost != null ? brl(Number(i.quantity) * Number(i.unit_cost)) : "",
              r.status,
            ];
          }),
        ),
      ),
    );
  }

  return (
    <>
      <PageHeader title="Histórico" description="Compras recebidas nesta unidade." />
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="hc-from">De</Label>
            <BrDateInput id="hc-from" value={from} onChange={setFrom} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hc-to">Até</Label>
            <BrDateInput id="hc-to" value={to} onChange={setTo} />
          </div>
          <Button variant="outline" disabled={list.length === 0} onClick={exportCsv}>
            <Download className="mr-2 size-4" aria-hidden /> Baixar planilha
          </Button>
          <span className="ml-auto text-sm">
            Total comprado: <strong>{brl(total)}</strong>
          </span>
        </div>
      </SectionCard>

      {changes.length > 0 ? (
        <SectionCard title="Preço mudou desde a compra anterior">
          <ul className="divide-y divide-foreground/15">
            {changes.map((c) => {
              const p = productById.get(c.catalogItemId);
              return (
                <li key={c.catalogItemId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{p?.name ?? "Produto"}</span>
                  <span className={c.change > 0 ? "flex items-center gap-1 font-semibold text-destructive" : "flex items-center gap-1 font-semibold"}>
                    {c.change > 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
                    {brl(c.previous)} → {brl(c.last)} ({c.change > 0 ? "+" : ""}
                    {String(c.change).replace(".", ",")}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title={`Recebimentos (${list.length})`}>
        {receipts.isLoading ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState title="Nenhuma compra recebida no período" />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {list.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-expanded={openId === r.id}>
                  <span className="flex min-w-0 items-center gap-2">
                    {openId === r.id ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {r.supplier_id ? (supplierName.get(r.supplier_id) ?? "Fornecedor") : "Sem fornecedor"}
                        {r.invoice_number ? ` · nota ${r.invoice_number}` : ""}
                      </span>
                      <span className="meta-mono">
                        {dateTimeFmt(r.received_at)} · {r.items.length} produto(s)
                        {r.due_date ? ` · vence ${dateFmt(`${r.due_date}T12:00:00`)}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={r.status === "cancelado" ? "font-semibold text-muted-foreground line-through" : "font-semibold"}>{brl(r.total_amount)}</span>
                    {r.status === "cancelado" ? <StatusBadge tone="danger">Cancelado</StatusBadge> : null}
                  </span>
                </button>
                {openId === r.id ? (
                  <div className="mt-2 rounded-[10px] bg-secondary p-3">
                    <ul className="space-y-1">
                      {r.items.map((i) => {
                        const p = productById.get(i.catalog_item_id);
                        return (
                          <li key={i.id} className="flex justify-between gap-3">
                            <span>
                              {qty(i.quantity)} {p?.unit ?? ""} · {p?.name ?? "Produto"}
                            </span>
                            <span>{i.unit_cost != null ? `${brl(i.unit_cost)} cada` : "sem custo"}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {r.status === "cancelado" ? (
                      <p className="mt-2 text-muted-foreground">Cancelado em {dateTimeFmt(r.canceled_at)}{r.cancel_reason ? ` · ${r.cancel_reason}` : ""}</p>
                    ) : (
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="outline"
                        disabled={cancel.isPending}
                        onClick={() => {
                          const reason = window.prompt("Cancelar este recebimento? O estoque será devolvido. Motivo (opcional):");
                          if (reason !== null) cancel.mutate({ id: r.id, reason: reason.trim() });
                        }}
                      >
                        Cancelar recebimento
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

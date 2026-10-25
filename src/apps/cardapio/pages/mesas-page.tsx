import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { dmdb } from "../lib/db";
import { dmKey, useOpenTabs } from "../lib/queries";
import { ago, tabTotal } from "../lib/rules";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

/** Contas das mesas (pagamento no final): o que cada mesa pediu e o total; fechar a conta quando pagar. */
export function MesasPage() {
  const { activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const tabs = useOpenTabs(activeUnitId);

  const close = useMutation({
    mutationFn: async (tabId: string) => {
      const { error } = await dmdb.rpc("dm_close_tab", { _tab_id: tabId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Conta fechada.");
      void queryClient.invalidateQueries({ queryKey: dmKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível fechar a conta."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma loja" />;
  if (tabs.isLoading) return <LoadingState />;
  const list = tabs.data ?? [];

  return (
    <>
      <PageHeader title="Mesas" description="Contas abertas. Feche a conta quando a mesa pagar." />
      {list.length === 0 ? (
        <EmptyState title="Nenhuma mesa com conta aberta" description="A conta abre sozinha no primeiro pedido da mesa." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => {
            const total = tabTotal(t.orders);
            // Junta itens iguais (2 pedidos de cappuccino = 3× Cappuccino).
            const lines = new Map<string, { qty: number; value: number }>();
            for (const i of t.items) {
              const cur = lines.get(i.name) ?? { qty: 0, value: 0 };
              lines.set(i.name, { qty: cur.qty + i.quantity, value: cur.value + i.quantity * Number(i.unit_price) });
            }
            const pending = t.orders.filter((o) => ["novo", "aceito", "preparando", "pronto"].includes(o.status)).length;
            return (
              <article key={t.id} className="flex flex-col rounded-[12px] border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_var(--ink)]">
                <header className="flex items-baseline justify-between gap-2">
                  <h2 className="display-type text-xl">Mesa {t.table_label}</h2>
                  <span className="meta-mono">aberta {ago(t.opened_at)}</span>
                </header>
                <p className="meta-mono">
                  {t.orders.length} pedido(s){pending ? ` · ${pending} em andamento` : ""}
                </p>
                <ul className="my-3 flex-1 space-y-0.5 text-sm">
                  {[...lines.entries()].map(([name, v]) => (
                    <li key={name} className="flex justify-between gap-2">
                      <span>
                        {v.qty}× {name}
                      </span>
                      <span>{brl(v.value)}</span>
                    </li>
                  ))}
                </ul>
                <p className="flex items-baseline justify-between border-t-2 border-foreground pt-2">
                  <span className="text-sm">Total</span>
                  <span className="text-2xl font-bold">{brl(total)}</span>
                </p>
                <Button
                  className="mt-3"
                  disabled={close.isPending}
                  onClick={() => {
                    const warn = pending ? `\n\nAtenção: ${pending} pedido(s) ainda não foram entregues.` : "";
                    if (window.confirm(`Fechar a conta da mesa ${t.table_label}? Total ${brl(total)}.${warn}`)) close.mutate(t.id);
                  }}
                >
                  Fechar conta
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

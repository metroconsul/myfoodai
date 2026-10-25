import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { dmdb, type OrderStatus } from "../lib/db";
import { dmKey, useOrders, useStore, type OrderWithItems } from "../lib/queries";
import { useCardapioRoles } from "../lib/roles";
import { FINAL, NEXT_STEP, STATUS_LABEL, ago } from "../lib/rules";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const COLUMNS: { title: string; statuses: OrderStatus[] }[] = [
  { title: "Novos", statuses: ["novo"] },
  { title: "Em preparo", statuses: ["aceito", "preparando"] },
  { title: "Prontos para entregar", statuses: ["pronto"] },
];

/** Bipe curto (sem arquivo de som). */
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // sem áudio no navegador
  }
}

/** Pedidos da loja em tempo quase real: novos → em preparo → prontos. */
export function PedidosPage() {
  const { activeUnitId } = useWorkspace();
  const { canManage } = useCardapioRoles();
  const queryClient = useQueryClient();
  const store = useStore(activeUnitId);
  const orders = useOrders(activeUnitId);
  const [sound, setSound] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  // Aviso sonoro quando chega pedido novo (depois da primeira carga).
  useEffect(() => {
    const novos = (orders.data ?? []).filter((o) => o.status === "novo").map((o) => o.id);
    if (seen.current === null) {
      seen.current = new Set(novos);
      return;
    }
    const fresh = novos.filter((id) => !seen.current!.has(id));
    novos.forEach((id) => seen.current!.add(id));
    if (fresh.length) {
      if (sound) beep();
      toast.success(fresh.length === 1 ? "Pedido novo!" : `${fresh.length} pedidos novos!`);
    }
  }, [orders.data, sound]);

  const move = useMutation({
    mutationFn: async (v: { id: string; status: OrderStatus }) => {
      const { error } = await dmdb.from("dm_orders").update({ status: v.status }).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: dmKey }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível atualizar."),
  });

  const toggleOpen = useMutation({
    mutationFn: async (is_open: boolean) => {
      const { error } = await dmdb.from("dm_stores").update({ is_open }).eq("unit_id", activeUnitId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, open) => {
      toast.success(open ? "Loja aberta para pedidos." : "Loja fechada para pedidos.");
      void queryClient.invalidateQueries({ queryKey: dmKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível atualizar."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma loja" />;
  if (store.isLoading || orders.isLoading) return <LoadingState />;
  if (!store.data) {
    return (
      <EmptyState
        title="O cardápio desta loja ainda não foi configurado"
        description={canManage ? "Defina o endereço do cardápio e monte os itens para começar a receber pedidos." : "Peça ao gerente para configurar o cardápio digital."}
        action={
          canManage ? (
            <Button asChild>
              <Link to="/cardapio/configuracoes">Configurar agora</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  const list = orders.data ?? [];
  const finished = list.filter((o) => FINAL.includes(o.status)).slice(-10).reverse();

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Atualiza sozinho a cada 5 segundos."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setSound((s) => !s)} aria-pressed={sound}>
              {sound ? <Bell className="mr-2 size-4" aria-hidden /> : <BellOff className="mr-2 size-4" aria-hidden />} {sound ? "Som ligado" : "Ligar som"}
            </Button>
            {canManage ? (
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Switch checked={store.data.is_open} onCheckedChange={(v) => toggleOpen.mutate(v)} /> {store.data.is_open ? "Aberto para pedidos" : "Fechado para pedidos"}
              </label>
            ) : (
              <StatusBadge tone={store.data.is_open ? "ok" : "warn"}>{store.data.is_open ? "Aberto" : "Fechado"}</StatusBadge>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const mine = list.filter((o) => col.statuses.includes(o.status));
          return (
            <section key={col.title} className="space-y-3" aria-label={col.title}>
              <h2 className="display-type flex items-center gap-2 text-base">
                {col.title} <span className="rounded-full bg-foreground px-2 text-xs text-background">{mine.length}</span>
              </h2>
              {mine.length === 0 ? <p className="text-sm text-muted-foreground">Nada aqui.</p> : null}
              {mine.map((o) => (
                <OrderCard key={o.id} o={o} busy={move.isPending} onMove={(status) => move.mutate({ id: o.id, status })} />
              ))}
            </section>
          );
        })}
      </div>

      {finished.length > 0 ? (
        <SectionCard title="Finalizados recentemente">
          <ul className="divide-y divide-foreground/15 text-sm">
            {finished.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  Nº {o.number} · {o.mode === "mesa" ? `Mesa ${o.table_label}` : `Retirada · ${o.customer_name}`}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{brl(Number(o.total))}</span>
                  <StatusBadge tone={o.status === "entregue" ? "ok" : "danger"}>{STATUS_LABEL[o.status]}</StatusBadge>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </>
  );
}

function OrderCard({ o, busy, onMove }: { o: OrderWithItems; busy: boolean; onMove: (s: OrderStatus) => void }) {
  const next = NEXT_STEP[o.status];
  return (
    <article className={cn("rounded-[12px] border-2 border-foreground bg-card p-3 shadow-[3px_3px_0_var(--ink)]", o.status === "novo" && "bg-accent/40")}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="display-type text-lg leading-none">Nº {o.number}</p>
          <p className="mt-1 text-sm font-semibold">{o.mode === "mesa" ? `Mesa ${o.table_label}` : "Retirada"} · {o.customer_name}</p>
          {o.mode === "retirada" && o.customer_phone ? <p className="meta-mono">{o.customer_phone}</p> : null}
        </div>
        <span className="meta-mono whitespace-nowrap">{ago(o.created_at)}</span>
      </header>
      <ul className="mt-2 space-y-0.5 text-sm">
        {o.items.map((i) => (
          <li key={i.id}>
            <strong>{i.quantity}×</strong> {i.name}
            {i.notes ? <span className="block text-xs text-muted-foreground">{i.notes}</span> : null}
          </li>
        ))}
      </ul>
      {o.notes ? <p className="mt-2 rounded-[8px] bg-secondary p-2 text-sm">Obs.: {o.notes}</p> : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-semibold">{brl(Number(o.total))}</span>
        <span className="flex gap-1">
          {o.status === "novo" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Recusar o pedido nº ${o.number}?`)) onMove("recusado");
              }}
            >
              Recusar
            </Button>
          ) : null}
          {next ? (
            <Button size="sm" disabled={busy} onClick={() => onMove(next.to)}>
              {next.label}
            </Button>
          ) : null}
        </span>
      </div>
    </article>
  );
}

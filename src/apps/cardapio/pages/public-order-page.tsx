import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dmdb } from "../lib/db";
import { CUSTOMER_STEPS, FINAL, stepIndex } from "../lib/rules";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

/** Acompanhamento do pedido pelo cliente (link secreto). Atualiza sozinho até o pedido terminar. */
export function PublicOrderPage({ slug, token }: { slug: string; token: string }) {
  const order = useQuery({
    queryKey: ["dm-public-order", token],
    queryFn: async () => {
      const { data, error } = await dmdb.rpc("dm_order_status", { _token: token });
      if (error) throw new Error(error.message);
      return data;
    },
    refetchInterval: (q) => (q.state.data && FINAL.includes(q.state.data.status) ? false : 8000),
  });

  if (order.isLoading) return <Centered>Carregando o pedido…</Centered>;
  const o = order.data;
  if (!o) return <Centered>Pedido não encontrado.</Centered>;
  const current = stepIndex(o.status);
  const stopped = o.status === "recusado" || o.status === "cancelado";
  const again = o.mode === "mesa" && o.table ? { mesa: o.table } : {};

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md space-y-5 px-4 py-8">
        <div>
          <p className="text-sm text-muted-foreground">{o.store.name}</p>
          <h1 className="display-type text-3xl">Pedido nº {o.number}</h1>
          <p className="text-sm">{o.mode === "mesa" ? `Mesa ${o.table}` : "Retirada no balcão"}</p>
        </div>

        {stopped ? (
          <div className="rounded-[12px] border-2 border-destructive p-4 text-sm">
            <p className="font-semibold">{o.status === "recusado" ? "O estabelecimento não pôde aceitar este pedido." : "Este pedido foi cancelado."}</p>
            <p className="mt-1 text-muted-foreground">Fale com a equipe se tiver dúvida.</p>
          </div>
        ) : (
          <ol className="space-y-2" aria-label="Andamento do pedido">
            {CUSTOMER_STEPS.map((s, i) => {
              const done = i <= current;
              return (
                <li key={s.status} className="flex items-center gap-3">
                  <span className={cn("flex size-7 items-center justify-center rounded-full border-2 border-foreground", done ? "bg-accent" : "bg-card")}>
                    {done ? <Check className="size-4" /> : null}
                  </span>
                  <span className={cn("font-semibold", !done && "text-muted-foreground", i === current && "underline")}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="rounded-[12px] border-2 border-foreground bg-card p-4">
          <ul className="space-y-1 text-sm">
            {o.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span>
                  {i.quantity}× {i.name}
                  {i.notes ? <span className="block text-xs text-muted-foreground">{i.notes}</span> : null}
                </span>
                <span>{brl(Number(i.unit_price) * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t-2 border-foreground pt-2 font-bold">
            <span>Total</span>
            <span>{brl(Number(o.total))}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{o.mode === "mesa" ? "Pagamento na conta, ao final." : "Pagamento no balcão, ao retirar."}</p>
        </div>

        {!FINAL.includes(o.status) ? <p className="text-center text-xs text-muted-foreground">Esta página atualiza sozinha.</p> : null}
        <Button asChild variant="outline" className="w-full">
          <Link to="/c/$slug" params={{ slug }} search={again}>
            Pedir mais
          </Link>
        </Button>
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">{children}</div>;
}

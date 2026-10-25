import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { dmdb, photoUrl, type OrderMode } from "../lib/db";
import { addToCart, byCategory, cartCount, cartTotal, changeQty, type CartLine } from "../lib/rules";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// Carrinho guardado no próprio celular (some ao enviar). Pode não existir (aba anônima): a página funciona sem.
function loadCart(slug: string): CartLine[] {
  try {
    const raw = localStorage.getItem(`myfoods-cardapio:${slug}`);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}
function saveCart(slug: string, cart: CartLine[]) {
  try {
    localStorage.setItem(`myfoods-cardapio:${slug}`, JSON.stringify(cart));
  } catch {
    // sem armazenamento: segue só na memória
  }
}

/** Cardápio público da loja (sem login). Com ?mesa=5 (QR da mesa) o pedido já vai para a mesa. */
export function PublicMenuPage({ slug, mesa }: { slug: string; mesa?: string | undefined }) {
  const navigate = useNavigate();
  const menu = useQuery({
    queryKey: ["dm-public", slug],
    queryFn: async () => {
      const { data, error } = await dmdb.rpc("dm_public_menu", { _slug: slug });
      if (error) throw new Error(error.message);
      return data;
    },
    refetchInterval: 60_000,
  });
  const [cart, setCart] = useState<CartLine[]>(() => loadCart(slug));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<OrderMode>(mesa ? "mesa" : "mesa");
  const [table, setTable] = useState(mesa ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  useEffect(() => saveCart(slug, cart), [slug, cart]);

  const store = menu.data?.store;
  const items = useMemo(() => menu.data?.items ?? [], [menu.data]);
  const groups = byCategory(items);
  // Itens que saíram do cardápio ou esgotaram deixam o carrinho.
  useEffect(() => {
    if (!menu.data) return;
    const ok = new Map(items.filter((i) => i.available).map((i) => [i.id, i]));
    setCart((c) => c.filter((l) => ok.has(l.itemId)).map((l) => ({ ...l, price: Number(ok.get(l.itemId)!.price), name: ok.get(l.itemId)!.name })));
  }, [menu.data, items]);
  useEffect(() => {
    if (!store) return;
    if (mesa) setMode("mesa");
    else if (!store.accepts_table) setMode("retirada");
    else if (!store.accepts_pickup) setMode("mesa");
  }, [store, mesa]);

  const send = useMutation({
    mutationFn: async () => {
      const { data, error } = await dmdb.rpc("dm_place_order", {
        _slug: slug,
        _mode: mode,
        _table: mode === "mesa" ? table.trim() : null,
        _name: name.trim(),
        _phone: mode === "retirada" ? phone : null,
        _notes: notes.trim() || null,
        _items: cart.map((l) => ({ item_id: l.itemId, quantity: l.quantity })),
        _client_key: clientKey,
      });
      if (error) throw new Error(error.message);
      return data!;
    },
    onSuccess: (r) => {
      setCart([]);
      setClientKey(crypto.randomUUID());
      setOpen(false);
      void navigate({ to: "/c/$slug/pedido/$token", params: { slug, token: r.token } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível enviar o pedido."),
  });

  if (menu.isLoading) return <Centered>Carregando o cardápio…</Centered>;
  if (menu.isError) return <Centered>Não foi possível abrir o cardápio. Verifique a internet e tente de novo.</Centered>;
  if (!store) return <Centered>Cardápio não encontrado. Confira o link com o estabelecimento.</Centered>;

  const total = cartTotal(cart);
  const phoneDigits = phone.replace(/\D/g, "");
  const canSend =
    store.is_open &&
    cart.length > 0 &&
    name.trim().length > 0 &&
    (mode === "mesa" ? table.trim().length > 0 : phoneDigits.length >= 10 && phoneDigits.length <= 13);

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="border-b-2 border-foreground bg-card">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Store className="size-4" aria-hidden /> Cardápio
          </p>
          <h1 className="display-type mt-1 text-2xl">{store.name}</h1>
          <p className="mt-1 text-sm">
            {store.is_open ? (
              <span className="font-semibold text-success">● Aberto para pedidos</span>
            ) : (
              <span className="font-semibold text-destructive">● Fechado para pedidos agora</span>
            )}
            {mesa ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 font-semibold">Mesa {mesa}</span> : null}
          </p>
          {store.notice ? <p className="mt-2 rounded-[8px] bg-secondary p-2 text-sm">{store.notice}</p> : null}
        </div>
        {groups.length > 1 ? (
          <nav className="sticky top-0 mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pb-3" aria-label="Categorias">
            {groups.map(([c]) => (
              <a key={c} href={`#cat-${encodeURIComponent(c)}`} className="whitespace-nowrap rounded-full border-2 border-foreground px-3 py-1 text-sm font-semibold">
                {c}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-5">
        {items.length === 0 ? <p className="text-center text-muted-foreground">O cardápio ainda está sendo preparado.</p> : null}
        {groups.map(([cat, list]) => (
          <section key={cat} id={`cat-${encodeURIComponent(cat)}`} className="scroll-mt-4 space-y-2">
            <h2 className="display-type text-lg">{cat}</h2>
            <ul className="space-y-2">
              {list.map((i) => {
                const inCart = cart.find((l) => l.itemId === i.id)?.quantity ?? 0;
                const photo = photoUrl(i.photo_path);
                return (
                  <li key={i.id} className={cn("flex gap-3 rounded-[12px] border-2 border-foreground bg-card p-3", !i.available && "opacity-60")}>
                    {photo ? <img src={photo} alt="" loading="lazy" className="size-20 shrink-0 rounded-[8px] object-cover" /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{i.name}</p>
                      {i.description ? <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{i.description}</p> : null}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-bold">{brl(Number(i.price))}</span>
                        {!i.available ? (
                          <span className="text-sm font-semibold text-muted-foreground">Esgotado</span>
                        ) : inCart ? (
                          <span className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="size-8" aria-label={`Menos ${i.name}`} onClick={() => setCart((c) => changeQty(c, i.id, inCart - 1))}>
                              <Minus className="size-4" />
                            </Button>
                            <span className="w-5 text-center font-bold">{inCart}</span>
                            <Button size="icon" className="size-8" aria-label={`Mais ${i.name}`} onClick={() => setCart((c) => changeQty(c, i.id, inCart + 1))}>
                              <Plus className="size-4" />
                            </Button>
                          </span>
                        ) : (
                          <Button size="sm" disabled={!store.is_open} onClick={() => setCart((c) => addToCart(c, i))}>
                            <Plus className="mr-1 size-4" aria-hidden /> Adicionar
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <p className="pt-4 text-center text-xs text-muted-foreground">Cardápio digital MyFoods</p>
      </main>

      {cart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t-2 border-foreground bg-card p-3">
          <div className="mx-auto max-w-2xl">
            <Button size="lg" className="w-full justify-between" onClick={() => setOpen(true)}>
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-5" aria-hidden /> Ver pedido · {cartCount(cart)} {cartCount(cart) === 1 ? "item" : "itens"}
              </span>
              <span>{brl(total)}</span>
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seu pedido</DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-foreground/15">
            {cart.map((l) => (
              <li key={l.itemId} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1">{l.name}</span>
                <span className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-7" aria-label={`Menos ${l.name}`} onClick={() => setCart((c) => changeQty(c, l.itemId, l.quantity - 1))}>
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-6 text-center font-semibold">{l.quantity}</span>
                  <Button variant="outline" size="icon" className="size-7" aria-label={`Mais ${l.name}`} onClick={() => setCart((c) => changeQty(c, l.itemId, l.quantity + 1))}>
                    <Plus className="size-3.5" />
                  </Button>
                </span>
                <span className="w-20 text-right font-semibold">{brl(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-baseline justify-between border-t-2 border-foreground pt-2">
            <span>Total</span>
            <span className="text-xl font-bold">{brl(total)}</span>
          </p>

          {!mesa && store.accepts_table && store.accepts_pickup ? (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Como vai receber">
              {(["mesa", "retirada"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={cn("rounded-[10px] border-2 border-foreground p-2 text-sm font-semibold", mode === m ? "bg-accent" : "bg-card")}
                >
                  {m === "mesa" ? "Estou na mesa" : "Vou retirar"}
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            {mode === "mesa" && !mesa ? (
              <div className="space-y-1.5">
                <Label htmlFor="pd-mesa">Número da mesa</Label>
                <Input id="pd-mesa" inputMode="numeric" value={table} onChange={(e) => setTable(e.target.value)} maxLength={20} placeholder="Ex.: 5" />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="pd-nome">Seu nome</Label>
              <Input id="pd-nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" />
            </div>
            {mode === "retirada" ? (
              <div className="space-y-1.5">
                <Label htmlFor="pd-tel">Celular (com DDD)</Label>
                <Input id="pd-tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="(12) 99999-0000" />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="pd-obs">Observação (opcional)</Label>
              <Input id="pd-obs" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Ex.: sem cebola" />
            </div>
            <p className="text-sm text-muted-foreground">
              {mode === "mesa" ? "Pagamento na conta, ao final." : "Pagamento no balcão, ao retirar."}
            </p>
          </div>
          <Button size="lg" className="w-full" disabled={!canSend || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? "Enviando…" : store.is_open ? `Enviar pedido · ${brl(total)}` : "Loja fechada para pedidos"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">{children}</div>;
}

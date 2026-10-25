import type { OrderStatus } from "./db";

/** Regras puras do Cardápio Digital (cobertas por testes). */

export const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: "Novo",
  aceito: "Aceito",
  preparando: "Em preparo",
  pronto: "Pronto",
  entregue: "Entregue",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

/** Próximo passo do pedido para a equipe (botão principal). */
export const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  novo: { to: "aceito", label: "Aceitar" },
  aceito: { to: "preparando", label: "Em preparo" },
  preparando: { to: "pronto", label: "Pronto" },
  pronto: { to: "entregue", label: "Entregue" },
};
export const FINAL: OrderStatus[] = ["entregue", "recusado", "cancelado"];

/** Etapas que o cliente vê (recusado/cancelado mostram mensagem própria). */
export const CUSTOMER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "novo", label: "Recebido" },
  { status: "aceito", label: "Aceito" },
  { status: "preparando", label: "Em preparo" },
  { status: "pronto", label: "Pronto" },
  { status: "entregue", label: "Entregue" },
];
export const stepIndex = (s: OrderStatus) => CUSTOMER_STEPS.findIndex((x) => x.status === s);

/** "Café do Centro!" → "cafe-do-centro" (endereço público da loja). */
export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
export const validSlug = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 40;

/** Link público da loja; com mesa vira o link do QR da mesa. */
export function storeLink(origin: string, slug: string, mesa?: string | null) {
  const base = `${origin.replace(/\/$/, "")}/c/${slug}`;
  return mesa ? `${base}?mesa=${encodeURIComponent(mesa)}` : base;
}

export type CartLine = { itemId: string; name: string; price: number; quantity: number };

export function addToCart(cart: CartLine[], item: { id: string; name: string; price: number | string }): CartLine[] {
  const found = cart.find((l) => l.itemId === item.id);
  if (found) return cart.map((l) => (l.itemId === item.id ? { ...l, quantity: Math.min(50, l.quantity + 1) } : l));
  return [...cart, { itemId: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
}
export function changeQty(cart: CartLine[], itemId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return cart.filter((l) => l.itemId !== itemId);
  return cart.map((l) => (l.itemId === itemId ? { ...l, quantity: Math.min(50, quantity) } : l));
}
export const cartTotal = (cart: CartLine[]) => Math.round(cart.reduce((a, l) => a + l.price * l.quantity, 0) * 100) / 100;
export const cartCount = (cart: CartLine[]) => cart.reduce((a, l) => a + l.quantity, 0);

/** Agrupa por categoria mantendo a ordem (sem categoria → "Outros"). */
export function byCategory<T extends { category: string | null }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const i of items) {
    const c = i.category?.trim() || "Outros";
    map.set(c, [...(map.get(c) ?? []), i]);
  }
  return [...map.entries()];
}

/** Total da conta da mesa (sem pedidos recusados/cancelados). */
export const tabTotal = (orders: { status: OrderStatus; total: number | string }[]) =>
  Math.round(orders.filter((o) => o.status !== "recusado" && o.status !== "cancelado").reduce((a, o) => a + Number(o.total), 0) * 100) / 100;

/** "há 3 min" (pedidos na tela da equipe). */
export function ago(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  return `há ${h}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
}

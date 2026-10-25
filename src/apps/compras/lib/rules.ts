import type { PdfLine } from "@/lib/simple-pdf";
import type { ListStatus } from "./db";

/** Regras puras das listas de compras (cobertas por testes). */

export const STATUS_LABEL: Record<ListStatus, string> = { aberta: "Aberta", enviada: "Enviada", concluida: "Concluída" };

type Item = { name: string; quantity: string | null; checked: boolean; position: number; created_at: string };

/** Como nas Notas: o que falta comprar em cima, na ordem em que foi anotado; comprados embaixo. */
export function sortItems<T extends Item>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(a.checked) - Number(b.checked) || a.position - b.position || a.created_at.localeCompare(b.created_at));
}

const ddmmyyyy = (d: Date) => d.toLocaleDateString("pt-BR");

/** Título padrão de uma lista nova: "Compras de 25/10". */
export const defaultTitle = (d = new Date()) => `Compras de ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

/** Separa "Leite 6 L" em nome e quantidade quando a pessoa digita tudo junto no campo do ingrediente. */
export function splitEntry(text: string): { name: string; quantity: string | null } {
  const t = text.trim().replace(/\s+/g, " ");
  const m = /^(.*?)[\s—–-]+(\d+(?:[.,]\d+)?\s*(?:[a-zA-ZçÇãõéêíóúá.]+)?(?:\s+de\s+\S+)?)$/.exec(t);
  if (m && m[1]!.trim().length > 0) return { name: m[1]!.trim(), quantity: m[2]!.trim() };
  return { name: t, quantity: null };
}

export function pdfLines(o: { title: string; company: string; unit: string; date?: Date; items: Item[] }): PdfLine[] {
  const items = sortItems(o.items);
  const bought = items.filter((i) => i.checked).length;
  return [
    { kind: "title", text: o.title },
    {
      kind: "subtitle",
      text: `${o.company} · ${o.unit} · ${ddmmyyyy(o.date ?? new Date())} · ${items.length} ${items.length === 1 ? "item" : "itens"}${bought ? ` (${bought} já comprado${bought === 1 ? "" : "s"})` : ""}`,
    },
    { kind: "gap" },
    ...items.map((i) => ({ kind: "item" as const, text: i.name, detail: i.quantity, checked: i.checked })),
  ];
}

/** Texto para o WhatsApp: só o que falta comprar. */
export function listMessage(o: { title: string; unit: string; buyer?: string | null | undefined; items: Item[] }) {
  const missing = sortItems(o.items).filter((i) => !i.checked);
  return [
    `${o.buyer ? `Olá, ${o.buyer}! ` : ""}${o.title} — ${o.unit}:`,
    "",
    ...missing.map((i) => `• ${i.name}${i.quantity ? ` — ${i.quantity}` : ""}`),
  ].join("\n");
}

/** Nome do arquivo: "compras-de-25-10.pdf". */
export const fileName = (title: string) =>
  `${title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "lista"}.pdf`;

/** Link do WhatsApp; telefone brasileiro sem DDI ganha 55; sem telefone, abre para escolher o contato. */
export function whatsappLink(phone: string | null | undefined, text: string) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `${digits.length >= 12 ? `https://wa.me/${digits}` : "https://wa.me/"}?text=${encodeURIComponent(text)}`;
}

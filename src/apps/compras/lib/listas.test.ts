import { describe, expect, it } from "vitest";
import { defaultTitle, fileName, listMessage, pdfLines, sortItems, splitEntry, whatsappLink } from "./rules";

const it0 = (name: string, quantity: string | null, checked: boolean, position: number) => ({ name, quantity, checked, position, created_at: `2026-10-25T10:0${position}:00Z` });
const items = [it0("Açúcar", "5 kg", true, 0), it0("Leite", "6 L", false, 1), it0("Ovos", null, false, 2)];

describe("listas de compras", () => {
  it("o que falta fica em cima, comprados embaixo", () => {
    expect(sortItems(items).map((i) => i.name)).toEqual(["Leite", "Ovos", "Açúcar"]);
  });

  it("separa nome e quantidade digitados juntos", () => {
    expect(splitEntry("Leite 6 L")).toEqual({ name: "Leite", quantity: "6 L" });
    expect(splitEntry("Farinha de trigo - 2 sacos")).toEqual({ name: "Farinha de trigo", quantity: "2 sacos" });
    expect(splitEntry("Ovos 3 dúzias")).toEqual({ name: "Ovos", quantity: "3 dúzias" });
    expect(splitEntry("Queijo 1,5 kg")).toEqual({ name: "Queijo", quantity: "1,5 kg" });
    expect(splitEntry("  Manteiga  ")).toEqual({ name: "Manteiga", quantity: null });
    expect(splitEntry("7up")).toEqual({ name: "7up", quantity: null });
  });

  it("texto do WhatsApp só com o que falta", () => {
    expect(listMessage({ title: "Compras de segunda", unit: "Centro", buyer: "João", items })).toBe(
      "Olá, João! Compras de segunda — Centro:\n\n• Leite — 6 L\n• Ovos",
    );
  });

  it("linhas do PDF com resumo e comprados marcados", () => {
    const l = pdfLines({ title: "Lista", company: "Ramos Food", unit: "Centro", date: new Date(2026, 9, 25), items });
    expect(l[1]).toEqual({ kind: "subtitle", text: "Ramos Food · Centro · 25/10/2026 · 3 itens (1 já comprado)" });
    expect(l.slice(3).map((x) => (x.kind === "item" ? [x.text, x.checked] : null))).toEqual([["Leite", false], ["Ovos", false], ["Açúcar", true]]);
  });

  it("nome de arquivo, título padrão e WhatsApp", () => {
    expect(fileName("Compras de 25/10 — Açougue")).toBe("compras-de-25-10-acougue.pdf");
    expect(defaultTitle(new Date(2026, 9, 5))).toBe("Compras de 05/10");
    expect(whatsappLink("(12) 98175-9663", "oi")).toBe("https://wa.me/5512981759663?text=oi");
    expect(whatsappLink(null, "a b")).toBe("https://wa.me/?text=a%20b");
  });
});

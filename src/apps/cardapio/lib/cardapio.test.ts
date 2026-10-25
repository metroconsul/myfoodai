import { describe, expect, it } from "vitest";
import { qrModules } from "./qr";
import { addToCart, ago, byCategory, cartCount, cartTotal, changeQty, slugify, stepIndex, storeLink, tabTotal, validSlug } from "./rules";

describe("cardápio digital", () => {
  it("endereço da loja", () => {
    expect(slugify("  Café do Centro!! ")).toBe("cafe-do-centro");
    expect(slugify("Ramos Food — Unidade 2")).toBe("ramos-food-unidade-2");
    expect(validSlug("cafe-do-centro")).toBe(true);
    expect(validSlug("ab")).toBe(false);
    expect(validSlug("cafe--centro")).toBe(false);
    expect(storeLink("https://myfoodsai.com/", "cafe", "5")).toBe("https://myfoodsai.com/c/cafe?mesa=5");
    expect(storeLink("https://myfoodsai.com", "cafe")).toBe("https://myfoodsai.com/c/cafe");
  });

  it("carrinho com limite de 50 por item", () => {
    let c = addToCart([], { id: "a", name: "Capp", price: "9.00" });
    c = addToCart(c, { id: "a", name: "Capp", price: "9.00" });
    c = addToCart(c, { id: "b", name: "Pão", price: 5.5 });
    expect(cartTotal(c)).toBe(23.5);
    expect(cartCount(c)).toBe(3);
    expect(changeQty(c, "a", 99).find((l) => l.itemId === "a")!.quantity).toBe(50);
    expect(changeQty(c, "b", 0).map((l) => l.itemId)).toEqual(["a"]);
  });

  it("categorias, conta da mesa, etapas e tempo", () => {
    expect(byCategory([{ category: "Bebidas" }, { category: null }]).map(([c]) => c)).toEqual(["Bebidas", "Outros"]);
    expect(tabTotal([{ status: "entregue", total: "18.00" }, { status: "recusado", total: 9 }, { status: "novo", total: 5.5 }])).toBe(23.5);
    expect(stepIndex("preparando")).toBe(2);
    expect(stepIndex("recusado")).toBe(-1);
    const now = Date.parse("2026-10-25T12:00:00Z");
    expect(ago("2026-10-25T11:59:40Z", now)).toBe("agora");
    expect(ago("2026-10-25T11:45:00Z", now)).toBe("há 15 min");
    expect(ago("2026-10-25T10:30:00Z", now)).toBe("há 1h30");
  });

  it("QR code é uma matriz quadrada com os 3 marcadores de canto", () => {
    const m = qrModules("https://myfoodsai.com/c/cafe?mesa=5");
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    const n = m.length;
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
      expect(m[r]![c]).toBe(true);
      expect(m[r + 3]![c + 3]).toBe(true);
    }
  });
});

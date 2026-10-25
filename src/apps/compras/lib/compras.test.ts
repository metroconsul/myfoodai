import { describe, expect, it } from "vitest";
import { linesTotal, orderMessage, priceChanges, suggestLines, whatsappLink } from "./rules";

describe("sugestão de pedido", () => {
  it("só abaixo do mínimo; completa até o máximo ou o dobro do mínimo; arredonda peças", () => {
    const r = suggestLines([
      { catalog_item_id: "leite", quantity: 4, minimum_stock: 10, maximum_stock: 30, unit_of_measure: "L", unit_cost: 5 },
      { catalog_item_id: "copo", quantity: 12.5, minimum_stock: 50, unit_of_measure: "un", unit_cost: null },
      { catalog_item_id: "cafe", quantity: 3, minimum_stock: 2, unit_of_measure: "kg" },
      { catalog_item_id: "sal", quantity: 0, minimum_stock: 0, unit_of_measure: "kg" },
    ]);
    expect(r).toEqual([
      { catalogItemId: "leite", quantity: 26, unitPrice: 5 },
      { catalogItemId: "copo", quantity: 88, unitPrice: null },
    ]);
  });
  it("soma o total ignorando preço vazio", () => {
    expect(linesTotal([{ quantity: 2, unitPrice: 5.5 }, { quantity: 3, unitPrice: null }])).toBe(11);
  });
});

describe("WhatsApp", () => {
  it("monta o texto do pedido", () => {
    expect(
      orderMessage({
        number: 7,
        supplier: "Laticínios Vale",
        company: "Ramos Food",
        unit: "Centro",
        expectedDate: "2026-10-28",
        notes: " entregar cedo ",
        items: [{ name: "Leite", unit: "L", quantity: 26 }, { name: "Café", unit: "kg", quantity: 1.5 }],
      }),
    ).toBe(
      "Olá, Laticínios Vale! Segue o pedido nº 7 de Ramos Food (Centro):\n\n• 26 L — Leite\n• 1,5 kg — Café\n\nEntrega: 28/10/2026\n\nObs.: entregar cedo\n\nPode confirmar, por favor? Obrigado!",
    );
  });
  it("põe o 55 no telefone brasileiro e funciona sem telefone", () => {
    expect(whatsappLink("(12) 98175-9663", "oi")).toBe("https://wa.me/5512981759663?text=oi");
    expect(whatsappLink("+55 12 98175-9663", "a b")).toBe("https://wa.me/5512981759663?text=a%20b");
    expect(whatsappLink(null, "oi")).toBe("https://wa.me/?text=oi");
  });
});

describe("variação de preço", () => {
  it("compara as duas últimas compras do produto", () => {
    expect(
      priceChanges([
        { catalog_item_id: "leite", unit_cost: 5, received_at: "2026-10-01" },
        { catalog_item_id: "leite", unit_cost: 5.5, received_at: "2026-10-20" },
        { catalog_item_id: "leite", unit_cost: 4, received_at: "2026-09-01" },
        { catalog_item_id: "cafe", unit_cost: 40, received_at: "2026-10-01" },
        { catalog_item_id: "cafe", unit_cost: 40, received_at: "2026-10-10" },
      ]),
    ).toEqual([{ catalogItemId: "leite", last: 5.5, previous: 5, change: 10 }]);
  });
});

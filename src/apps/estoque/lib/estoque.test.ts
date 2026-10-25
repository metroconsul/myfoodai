import { describe, expect, it } from "vitest";
import { isLow, movementSign, parseNumber } from "./labels";
import { consumption, staleItems, stockValue } from "./reports";

const items = [
  { id: "a", name: "Leite", unit_of_measure: "L", unit_cost: 5, last_movement_at: "2026-10-20T10:00:00Z", quantity: 10 },
  { id: "b", name: "Copo", unit_of_measure: "un", unit_cost: 0.2, last_movement_at: null, quantity: 100 },
  { id: "c", name: "Sal", unit_of_measure: "kg", unit_cost: null, last_movement_at: "2026-08-01T10:00:00Z", quantity: 0 },
];

describe("estoque", () => {
  it("estoque baixo: no mínimo ou negativo; mínimo zero não alerta", () => {
    expect(isLow({ quantity: 3, minimum_stock: 3 })).toBe(true);
    expect(isLow({ quantity: 4, minimum_stock: 3 })).toBe(false);
    expect(isLow({ quantity: 0, minimum_stock: 0 })).toBe(false);
    expect(isLow({ quantity: -1, minimum_stock: 0 })).toBe(true);
  });

  it("lê números com vírgula ou ponto", () => {
    expect(["1,5", "1.5", "1.234,5", "10", "", "abc"].map(parseNumber)).toEqual([1.5, 1.5, 1234.5, 10, NaN, NaN]);
  });

  it("sinal de cada tipo de movimento", () => {
    expect(["entrada", "saida", "perda", "transferencia", "inventario"].map(movementSign)).toEqual(["+", "−", "−", "−", "="]);
  });

  it("consumo soma saídas e perdas, ignora entradas e transferências, e valoriza pelo custo", () => {
    const r = consumption(
      [
        { inventory_item_id: "a", movement_type: "saida", quantity: 3 },
        { inventory_item_id: "a", movement_type: "perda", quantity: "1" },
        { inventory_item_id: "a", movement_type: "entrada", quantity: 50 },
        { inventory_item_id: "b", movement_type: "transferencia", quantity: 10 },
        { inventory_item_id: "b", movement_type: "saida", quantity: 20 },
      ],
      items,
    );
    expect(r).toEqual([
      { id: "b", name: "Copo", unit: "un", saida: 20, perda: 0, total: 20, value: 4 },
      { id: "a", name: "Leite", unit: "L", saida: 3, perda: 1, total: 4, value: 20 },
    ]);
  });

  it("parados: com saldo e sem movimento no prazo", () => {
    expect(staleItems(items, 30, new Date("2026-10-25T00:00:00Z")).map((i) => i.id)).toEqual(["b"]);
  });

  it("valor do estoque ignora custo vazio e saldo negativo", () => {
    expect(stockValue([...items, { quantity: -5, unit_cost: 10 }])).toBe(70);
  });
});

import { describe, expect, it, vi } from "vitest";
import { applyMovement } from "./stock.shared";

const client = (result: { data?: unknown; error?: { message: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { rpc, c: { rpc } as never };
};

describe("applyMovement", () => {
  it("envia todos os parâmetros com origem padrão 'estoque'", async () => {
    const { rpc, c } = client({ data: { movement_id: "m1", duplicate: false, before: 2, after: 5 } });
    const r = await applyMovement(c, { itemId: "i1", type: "entrada", quantity: 3, unitCost: 4.5 });
    expect(rpc).toHaveBeenCalledWith("stock_apply_movement", {
      _item_id: "i1",
      _type: "entrada",
      _quantity: 3,
      _unit_cost: 4.5,
      _reason: null,
      _reference: null,
      _supplier_id: null,
      _target_unit_id: null,
      _source_app: "estoque",
      _source_id: null,
    });
    expect(r).toEqual({ ok: true, movementId: "m1", duplicate: false, before: 2, after: 5 });
  });

  it("repassa a origem da integração e reconhece reenvio", async () => {
    const { rpc, c } = client({ data: { movement_id: "m1", duplicate: true, after: "5.000" } });
    const r = await applyMovement(c, { itemId: "i1", type: "entrada", quantity: 3, sourceApp: "compras", sourceId: "nf-1:1" });
    expect(rpc.mock.calls[0]![1]).toMatchObject({ _source_app: "compras", _source_id: "nf-1:1" });
    expect(r).toEqual({ ok: true, movementId: "m1", duplicate: true, after: 5 });
  });

  it("devolve a mensagem do banco quando recusa", async () => {
    const { c } = client({ error: { message: "Saldo insuficiente: há 1 e a movimentação pede 2." } });
    expect(await applyMovement(c, { itemId: "i1", type: "saida", quantity: 2 })).toEqual({
      ok: false,
      error: "Saldo insuficiente: há 1 e a movimentação pede 2.",
    });
  });
});

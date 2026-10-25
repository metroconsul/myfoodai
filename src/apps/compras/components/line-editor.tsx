import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, qty } from "@/apps/estoque/lib/labels";
import { lineValues, newKey, toText, type EditLine } from "../lib/lines";
import type { Product } from "../lib/queries";

/**
 * Lista de produtos com quantidade e preço (pedido e recebimento).
 * `fixedProducts`: no recebimento de um pedido, as linhas vêm do pedido (não troca o produto, pode zerar/remover).
 */
export function LineEditor({
  lines,
  onChange,
  products,
  priceLabel = "Preço por unidade",
  fixedProducts = false,
}: {
  lines: EditLine[];
  onChange: (lines: EditLine[]) => void;
  products: Product[];
  priceLabel?: string;
  fixedProducts?: boolean;
}) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const used = new Set(lines.map((l) => l.catalogItemId));
  const set = (key: string, patch: Partial<EditLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-2">
      {lines.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum produto ainda.</p> : null}
      {lines.map((l) => {
        const p = byId.get(l.catalogItemId);
        const v = lineValues(l);
        return (
          <div key={l.key} className="flex flex-wrap items-end gap-2 rounded-[10px] border-2 border-foreground/20 p-2">
            <div className="min-w-48 flex-1 space-y-1">
              {fixedProducts ? (
                <p className="pt-2 text-sm font-semibold">{p?.name ?? "Produto"}</p>
              ) : (
                <Select
                  value={l.catalogItemId}
                  onValueChange={(id) => set(l.key, { catalogItemId: id, priceText: l.priceText || toText(byId.get(id)?.unitCost ?? null) })}
                >
                  <SelectTrigger aria-label="Produto">
                    <SelectValue placeholder="Escolha o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      .filter((o) => o.id === l.catalogItemId || !used.has(o.id))
                      .map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                          {o.quantity != null ? ` · tem ${qty(o.quantity)} ${o.unit}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              {p ? (
                <p className="meta-mono">
                  {p.quantity != null ? `estoque ${qty(p.quantity)} ${p.unit}` : "sem estoque nesta unidade"}
                  {p.minimum > 0 ? ` · mínimo ${qty(p.minimum)}` : ""}
                  {l.ordered != null ? ` · pedido ${qty(l.ordered)}` : ""}
                </p>
              ) : null}
            </div>
            <label className="space-y-1 text-xs font-semibold">
              Quantidade{p ? ` (${p.unit})` : ""}
              <Input inputMode="decimal" value={l.qtyText} onChange={(e) => set(l.key, { qtyText: e.target.value })} className="w-24" />
            </label>
            <label className="space-y-1 text-xs font-semibold">
              {priceLabel}
              <Input inputMode="decimal" value={l.priceText} onChange={(e) => set(l.key, { priceText: e.target.value })} placeholder="R$" className="w-28" />
            </label>
            <span className="w-24 pb-2 text-right text-sm font-semibold">{v.valid && v.price != null ? brl(v.quantity * v.price) : "—"}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Remover" onClick={() => onChange(lines.filter((x) => x.key !== l.key))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
      {!fixedProducts ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, { key: newKey(), catalogItemId: "", qtyText: "", priceText: "" }])}>
          <Plus className="mr-2 size-4" aria-hidden /> Adicionar produto
        </Button>
      ) : null}
    </div>
  );
}

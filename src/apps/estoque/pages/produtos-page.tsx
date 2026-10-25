import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { MovementDialog, type DialogType } from "../components/movement-dialog";
import { ProductDialog } from "../components/product-dialog";
import { EPI_TYPES, ITEM_TYPE_LABEL, brl, isLow, qty } from "../lib/labels";
import { useStockItems, type StockItem } from "../lib/queries";

type Filter = "todos" | "estoque" | "epi";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "estoque", label: "Insumos e consumo" },
  { id: "epi", label: "EPIs e uniformes" },
];

/** Produtos da unidade com saldo, mínimo e botões rápidos de entrada, saída e ajuste. */
export function ProdutosPage() {
  const { activeUnitId } = useWorkspace();
  const items = useStockItems(activeUnitId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [onlyLow, setOnlyLow] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<StockItem | null | "novo">(null);
  const [moving, setMoving] = useState<{ item: StockItem; type: DialogType } | null>(null);

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;

  const all = items.data ?? [];
  const term = search.trim().toLowerCase();
  const list = all.filter(
    (i) =>
      (showInactive || i.active) &&
      (filter === "todos" || (filter === "epi") === (EPI_TYPES as readonly string[]).includes(i.item_type)) &&
      (!onlyLow || isLow(i)) &&
      (!term || i.name.toLowerCase().includes(term) || (i.category ?? "").toLowerCase().includes(term)),
  );

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Saldo de cada produto nesta unidade."
        actions={
          <Button onClick={() => setEditing("novo")}>
            <Plus className="mr-2 size-4" aria-hidden /> Novo produto
          </Button>
        }
      />
      <SectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto ou categoria" className="w-64 pl-8" aria-label="Buscar" />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-[8px] border-2 px-3 py-1.5 text-sm font-semibold",
                  filter === f.id ? "border-foreground bg-accent" : "border-transparent hover:border-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={onlyLow} onCheckedChange={setOnlyLow} /> Só estoque baixo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Mostrar inativos
          </label>
        </div>
      </SectionCard>

      <SectionCard title={`Produtos (${list.length})`}>
        {items.isLoading ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? "Nenhum produto nesta unidade" : "Nenhum produto com esse filtro"}
            description={all.length === 0 ? "Cadastre o primeiro produto em “Novo produto”." : ""}
          />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {list.map((i) => {
              const low = isLow(i);
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(i)} title="Editar produto">
                    <span className="block truncate font-semibold">
                      {i.name}
                      {!i.active ? <span className="ml-2 font-normal text-muted-foreground">(inativo)</span> : null}
                    </span>
                    <span className="meta-mono">
                      {[i.category, i.category?.toLowerCase() === ITEM_TYPE_LABEL[i.item_type]?.toLowerCase() ? null : ITEM_TYPE_LABEL[i.item_type], Number(i.minimum_stock) > 0 ? `mínimo ${qty(i.minimum_stock)}` : null, i.unit_cost != null ? brl(i.unit_cost) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  <span className="flex items-center gap-2">
                    <span className={cn("min-w-24 text-right text-base font-bold", Number(i.quantity) < 0 && "text-destructive")}>
                      {qty(i.quantity)} <span className="text-sm font-normal">{i.unit_of_measure}</span>
                    </span>
                    {low ? <StatusBadge tone={Number(i.quantity) <= 0 ? "danger" : "warn"}>Baixo</StatusBadge> : null}
                  </span>
                  {i.active ? (
                    <span className="flex gap-1">
                      <Button size="sm" onClick={() => setMoving({ item: i, type: "entrada" })}>
                        Entrada
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setMoving({ item: i, type: "saida" })}>
                        Saída
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setMoving({ item: i, type: "ajuste" })}>
                        Ajustar
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <ProductDialog open={editing !== null} item={editing === "novo" ? null : editing} onClose={() => setEditing(null)} />
      <MovementDialog open={moving !== null} items={all} item={moving?.item ?? null} type={moving?.type ?? "entrada"} onClose={() => setMoving(null)} />
    </>
  );
}

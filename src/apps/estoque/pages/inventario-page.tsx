import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { dateTimeFmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseNumber, qty } from "../lib/labels";
import { estoqueKey } from "../lib/queries";
import { closeCount, openCount } from "../lib/rpc";

/**
 * Inventário em 3 passos: começar (o sistema lista os produtos e o saldo esperado), digitar o contado, fechar.
 * Ao fechar, cada produto contado fica com o saldo contado (movimento "inventário"); os não contados não mudam.
 */
export function InventarioPage() {
  const { activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const key = [...estoqueKey, "count", activeUnitId];

  const counts = useQuery({
    queryKey: key,
    enabled: Boolean(activeUnitId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_counts")
        .select("id, name, status, created_at, closed_at")
        .eq("unit_id", activeUnitId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  const open = (counts.data ?? []).find((c) => c.status === "aberto") ?? null;
  const past = (counts.data ?? []).filter((c) => c.status !== "aberto");

  const start = useMutation({
    mutationFn: () => openCount(activeUnitId!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível começar."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;
  if (counts.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader title="Inventário" description="Conte o que tem na prateleira e o sistema acerta o saldo." />
      {open ? (
        <OpenCount countId={open.id} name={open.name ?? "Inventário"} />
      ) : (
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Nenhum inventário em andamento nesta unidade.</p>
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              <ClipboardList className="mr-2 size-4" aria-hidden /> Começar inventário
            </Button>
          </div>
        </SectionCard>
      )}
      {past.length > 0 ? (
        <SectionCard title="Inventários anteriores">
          <ul className="divide-y divide-foreground/15">
            {past.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="meta-mono">fechado em {dateTimeFmt(c.closed_at)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </>
  );
}

function OpenCount({ countId, name }: { countId: string; name: string }) {
  const queryClient = useQueryClient();
  const key = [...estoqueKey, "count-items", countId];
  const [draft, setDraft] = useState<Record<string, string>>({});

  const rows = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_count_items")
        .select("id, expected_quantity, counted_quantity, inventory_items(name, unit_of_measure, category)")
        .eq("count_id", countId);
      if (error) throw error;
      return (data ?? []).sort((a, b) => (a.inventory_items?.name ?? "").localeCompare(b.inventory_items?.name ?? ""));
    },
  });

  const saveOne = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number | null }) => {
      const { error } = await supabase.from("inventory_count_items").update({ counted_quantity: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: () => toast.error("Não foi possível salvar a contagem."),
  });

  const finish = useMutation({
    mutationFn: () => closeCount(countId),
    onSuccess: (n) => {
      toast.success(`Inventário fechado. ${n} produto(s) com saldo atualizado.`);
      void queryClient.invalidateQueries({ queryKey: estoqueKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível fechar."),
  });

  const list = rows.data ?? [];
  const counted = list.filter((r) => r.counted_quantity != null);
  const diffs = counted.filter((r) => Number(r.counted_quantity) !== Number(r.expected_quantity));

  function commit(id: string, current: number | null) {
    const text = draft[id];
    if (text === undefined) return;
    const value = text.trim() === "" ? null : parseNumber(text);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      toast.error("Quantidade inválida.");
      return;
    }
    if (value !== current) saveOne.mutate({ id, value });
  }

  return (
    <SectionCard
      title={name}
      action={<StatusBadge tone="warn">Em andamento</StatusBadge>}
    >
      <p className="mb-3 text-sm text-muted-foreground">
        {counted.length} de {list.length} contados · {diffs.length} com diferença. Deixe em branco o que não contar: o saldo dele não muda.
      </p>
      {rows.isLoading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <EmptyState title="Nenhum produto ativo nesta unidade" />
      ) : (
        <ul className="divide-y divide-foreground/15">
          {list.map((r) => {
            const current = r.counted_quantity == null ? null : Number(r.counted_quantity);
            const diff = current == null ? null : current - Number(r.expected_quantity);
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.inventory_items?.name ?? "Produto"}</span>
                  <span className="meta-mono">
                    sistema: {qty(r.expected_quantity)} {r.inventory_items?.unit_of_measure ?? ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    aria-label={`Contado de ${r.inventory_items?.name ?? "produto"}`}
                    className="w-28 text-right"
                    placeholder="contado"
                    value={draft[r.id] ?? (current == null ? "" : String(current).replace(".", ","))}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    onBlur={() => commit(r.id, current)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className={cn("w-20 text-right font-semibold", diff == null ? "text-muted-foreground" : diff === 0 ? "" : "text-destructive")}>
                    {diff == null ? "—" : diff === 0 ? "ok" : `${diff > 0 ? "+" : "−"}${qty(Math.abs(diff))}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          disabled={finish.isPending || counted.length === 0}
          onClick={() => {
            if (window.confirm(`Fechar o inventário? ${counted.length} produto(s) ficarão com o saldo contado.`)) finish.mutate();
          }}
        >
          {finish.isPending ? "Fechando…" : "Fechar inventário"}
        </Button>
      </div>
    </SectionCard>
  );
}

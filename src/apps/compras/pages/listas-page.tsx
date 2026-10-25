import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { dateTimeFmt } from "@/lib/format";
import { ldb } from "../lib/db";
import { listsKey, useLists } from "../lib/queries";
import { STATUS_LABEL, defaultTitle } from "../lib/rules";

/** Listas de compras da loja (como as Notas): as mais recentes primeiro; concluídas ficam escondidas. */
export function ListasPage() {
  const { activeUnitId, activeUnit } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lists = useLists(activeUnitId);
  const [showDone, setShowDone] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await ldb.from("shopping_lists").insert({ unit_id: activeUnitId!, title: defaultTitle() }).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Não foi possível criar a lista.");
      return data.id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: listsKey });
      void navigate({ to: "/compras/lista/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar a lista."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma loja" />;
  const all = lists.data ?? [];
  const shown = all.filter((l) => showDone || l.status !== "concluida");
  const doneCount = all.length - all.filter((l) => l.status !== "concluida").length;

  return (
    <>
      <PageHeader
        title="Listas de compras"
        description={`O que falta na ${activeUnit?.name ?? "loja"}. Anote, exporte em PDF e envie para quem faz as compras.`}
        actions={
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="mr-2 size-4" aria-hidden /> Nova lista
          </Button>
        }
      />
      {doneCount > 0 ? (
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showDone} onCheckedChange={setShowDone} /> Mostrar concluídas ({doneCount})
        </label>
      ) : null}
      {lists.isLoading ? (
        <LoadingState />
      ) : shown.length === 0 ? (
        <EmptyState title="Nenhuma lista aberta" description="Crie uma em “Nova lista” e anote o que está faltando." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((l) => (
            <Link
              key={l.id}
              to="/compras/lista/$id"
              params={{ id: l.id }}
              className="block rounded-[12px] border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_var(--ink)] hover:bg-secondary"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-tight">{l.title}</p>
                <StatusBadge tone={l.status === "aberta" ? "neutral" : l.status === "enviada" ? "info" : "ok"}>{STATUS_LABEL[l.status]}</StatusBadge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {l.preview.length ? l.preview.join(", ") + (l.missing > l.preview.length ? "…" : "") : l.total ? "Tudo comprado" : "Lista vazia"}
              </p>
              <p className="meta-mono mt-2">
                {l.missing} a comprar · {l.total} no total · {dateTimeFmt(l.updated_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

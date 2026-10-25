import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { dateTimeFmt } from "@/lib/format";
import { ENTRY_TYPE_LABEL, label } from "../lib/labels";

/** Pedidos de correção feitos pelo colaborador no Portal (aprovar ou recusar), como na tela antiga de marcações. */
export function CorrectionsSection() {
  const { activeUnitId, userId } = useWorkspace();
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ["ponto", "reviews", activeUnitId],
    enabled: Boolean(activeUnitId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entry_reviews")
        .select("*, employees(full_name)")
        .eq("unit_id", activeUnitId!)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovada" | "recusada" }) => {
      const { error } = await supabase
        .from("time_entry_reviews")
        .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: userId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada.");
      void queryClient.invalidateQueries({ queryKey: ["ponto"] });
    },
    onError: () => toast.error("Erro ao atualizar solicitação."),
  });
  const list = reviews.data ?? [];

  // Só aparece quando há pedido pendente (a tela Hoje mostra "tudo em dia" quando não há nada).
  if (list.length === 0) return null;
  return (
    <SectionCard title={`Pedidos de correção (${list.length})`}>
      <ul className="divide-y divide-foreground/15">
        {list.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <span className="min-w-0">
              <span className="block font-medium">{r.employees?.full_name ?? "Colaborador"}</span>
              <span className="meta-mono">
                {r.requested_entry_type ? `${label(ENTRY_TYPE_LABEL, r.requested_entry_type)} · ` : ""}
                {r.requested_time ? dateTimeFmt(r.requested_time) : "sem horário"}
              </span>
              {r.reason ? <span className="mt-1 block">{r.reason}</span> : null}
            </span>
            <span className="flex gap-2">
              <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, status: "aprovada" })}>
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: r.id, status: "recusada" })}
              >
                Recusar
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

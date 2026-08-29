import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState, StatusBadge, StatCard } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { dateTimeFmt, isoDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/time-entries")({
  head: () => ({
    meta: [
      { title: `Registros de ponto — ${BRAND_NAME}` },
      { name: "description", content: "Marcações do dia com status de geolocalização e pedidos de correção." },
      { property: "og:title", content: `Registros de ponto — ${BRAND_NAME}` },
      { property: "og:description", content: "Auditoria diária das marcações de ponto." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TimeEntriesPage,
});

function TimeEntriesPage() {
  const { activeUnitId, userId } = useWorkspace();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(isoDate(new Date()));

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["time-entries", activeUnitId, day],
    enabled: !!activeUnitId,
    queryFn: async () =>
      (
        await supabase
          .from("time_entries")
          .select("*, employees(full_name)")
          .eq("unit_id", activeUnitId!)
          .gte("server_time", new Date(`${day}T00:00:00`).toISOString())
          .lt("server_time", new Date(`${day}T23:59:59`).toISOString())
          .order("server_time", { ascending: false })
      ).data ?? [],
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["time-reviews"],
    queryFn: async () =>
      (
        await supabase
          .from("time_entry_reviews")
          .select("*, employees(full_name)")
          .eq("status", "pendente")
          .order("created_at", { ascending: false })
      ).data ?? [],
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
      queryClient.invalidateQueries({ queryKey: ["time-reviews"] });
    },
    onError: () => toast.error("Erro ao atualizar solicitação."),
  });

  const outside = entries.filter((e) => e.geo_status !== "dentro_do_raio").length;

  return (
    <>
      <PageHeader
        title="Registros de ponto"
        description="Marcações do Portal do Colaborador com validação de raio e trilha de auditoria."
        actions={
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="day" className="sr-only">
                Dia
              </Label>
              <Input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Marcações no dia" value={entries.length} />
        <StatCard label="Fora do raio / sem GPS" value={outside} tone={outside ? "warning" : "success"} />
        <StatCard label="Correções pendentes" value={reviews.length} tone={reviews.length ? "warning" : "success"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Marcações">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : entries.length === 0 ? (
            <EmptyState title="Nenhuma marcação neste dia" />
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {(e.employees as { full_name: string } | null)?.full_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.entry_type.replaceAll("_", " ")} · {dateTimeFmt(e.server_time)}
                      {e.distance_meters != null ? ` · ${Math.round(e.distance_meters)}m` : ""}
                    </span>
                  </span>
                  <StatusBadge tone={e.geo_status === "dentro_do_raio" ? "ok" : "warn"}>
                    {e.geo_status.replaceAll("_", " ")}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Pedidos de correção">
          {reviews.length === 0 ? (
            <EmptyState title="Nenhuma solicitação pendente" />
          ) : (
            <ul className="divide-y divide-border">
              {reviews.map((r) => (
                <li key={r.id} className="py-3 text-sm">
                  <p className="font-medium">{(r.employees as { full_name: string } | null)?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.request_type} · {r.requested_time ? dateTimeFmt(r.requested_time) : "sem horário"}
                  </p>
                  {r.reason ? <p className="mt-1 text-xs">{r.reason}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => decide.mutate({ id: r.id, status: "aprovada" })}>
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decide.mutate({ id: r.id, status: "recusada" })}
                    >
                      Recusar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

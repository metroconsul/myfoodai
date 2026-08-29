import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { dateFmt, dateTimeFmt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/schedule-history")({
  head: () => ({
    meta: [
      { title: `Histórico de escalas — ${BRAND_NAME}` },
      { name: "description", content: "Versões publicadas, alterações e trocas de turno solicitadas." },
      { property: "og:title", content: `Histórico de escalas — ${BRAND_NAME}` },
      { property: "og:description", content: "Trilha de alterações das escalas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { activeUnitId } = useWorkspace();

  const schedules = useQuery({
    queryKey: ["schedules-history", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () =>
      (
        await supabase
          .from("schedules")
          .select("*")
          .eq("unit_id", activeUnitId!)
          .order("period_start", { ascending: false })
          .limit(20)
      ).data ?? [],
  });

  const changes = useQuery({
    queryKey: ["schedule-changes"],
    queryFn: async () =>
      (
        await supabase
          .from("schedule_changes")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30)
      ).data ?? [],
  });

  const swaps = useQuery({
    queryKey: ["swaps"],
    queryFn: async () =>
      (
        await supabase
          .from("shift_swap_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
  });

  return (
    <>
      <PageHeader title="Histórico de escalas" description="Versões, alterações e pedidos de troca de turno." />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Escalas por período">
          {(schedules.data ?? []).length === 0 ? (
            <EmptyState title="Nenhuma escala registrada" />
          ) : (
            <ul className="divide-y-2 divide-foreground">
              {schedules.data!.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    {dateFmt(s.period_start)} – {dateFmt(s.period_end)}
                    <span className="ml-2 text-xs text-muted-foreground">v{s.version}</span>
                  </span>
                  <StatusBadge tone={s.status === "publicada" ? "ok" : s.status === "arquivada" ? "neutral" : "warn"}>
                    {s.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Alterações recentes">
          {(changes.data ?? []).length === 0 ? (
            <EmptyState title="Sem alterações registradas" />
          ) : (
            <ul className="divide-y-2 divide-foreground">
              {changes.data!.map((c) => (
                <li key={c.id} className="py-2.5 text-sm">
                  <span className="font-medium">{c.change_type}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{dateTimeFmt(c.created_at)}</span>
                  {c.reason ? <p className="text-xs text-muted-foreground">{c.reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Trocas de turno">
          {(swaps.data ?? []).length === 0 ? (
            <EmptyState title="Nenhuma solicitação de troca" />
          ) : (
            <ul className="divide-y-2 divide-foreground">
              {swaps.data!.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{dateTimeFmt(s.created_at)}</span>
                  <StatusBadge tone={s.status === "aprovada" ? "ok" : s.status === "recusada" ? "danger" : "warn"}>
                    {s.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

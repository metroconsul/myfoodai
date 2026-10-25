import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, FileSignature, UserCheck } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/ui-kit";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { dateTimeFmt, timeFmt } from "@/lib/format";
import { daysAgoYmd, localYmd } from "../lib/dates";
import { CorrectionsSection } from "../components/corrections";
import { ENTRY_TYPE_LABEL, GEO_STATUS_LABEL, label, needsReview } from "../lib/labels";
import { ALL, useEntries } from "../lib/queries";

const REVIEW_DAYS = 7;

/**
 * Hoje: tudo o que o gestor precisa no dia, numa tela só (unidade ativa).
 * Números do dia, "Precisa de você" (pedidos de correção e batidas para revisar) e últimas batidas.
 */
export function PontoDashboardPage() {
  const { activeUnitId, activeUnit } = useWorkspace();
  const today = localYmd();
  const recent = useEntries(activeUnitId, daysAgoYmd(REVIEW_DAYS), today, ALL);

  const counts = useQuery({
    queryKey: ["ponto", "today-counts", activeUnitId],
    enabled: Boolean(activeUnitId),
    queryFn: async () => {
      const [reviews, cards] = await Promise.all([
        supabase.from("time_entry_reviews").select("id", { count: "exact", head: true }).eq("unit_id", activeUnitId!).eq("status", "pendente"),
        supabase
          .from("point_cards")
          .select("id", { count: "exact", head: true })
          .eq("unit_id", activeUnitId!)
          .not("published_at", "is", null)
          .is("signed_at", null),
      ]);
      const error = reviews.error ?? cards.error;
      if (error) throw error;
      return { reviews: reviews.count ?? 0, cards: cards.count ?? 0 };
    },
  });

  const all = recent.data ?? [];
  const todays = all.filter((e) => localYmd(new Date(e.server_time)) === today);
  // Presente = última batida de hoje não é saída (lista vem da mais recente para a mais antiga).
  const last = new Map<string, string>();
  for (const e of todays) if (!last.has(e.employee_id)) last.set(e.employee_id, e.entry_type);
  const present = [...last.values()].filter((t) => t !== "saida").length;
  const flagged = all.filter(needsReview);
  const pending = flagged.length + (counts.data?.reviews ?? 0);

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;

  return (
    <>
      <PageHeader title="Hoje" description={activeUnit?.name ?? ""} />
      {recent.isLoading || counts.isLoading ? (
        <LoadingState />
      ) : recent.isError || counts.isError ? (
        <EmptyState title="Não foi possível carregar o ponto de hoje" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Presentes agora" value={present} icon={<UserCheck className="size-5" />} tone="success" />
            <StatCard label="Batidas hoje" value={todays.length} icon={<Clock className="size-5" />} />
            <StatCard
              label="Precisa de você"
              value={pending}
              icon={<AlertTriangle className="size-5" />}
              tone={pending ? "warning" : "success"}
            />
            <StatCard label="Cartões sem aceite" value={counts.data!.cards} icon={<FileSignature className="size-5" />} />
          </div>

          {pending === 0 ? (
            <SectionCard title="Precisa de você">
              <EmptyState title="Tudo em dia" description="Nenhum pedido de correção e nenhuma batida para revisar." />
            </SectionCard>
          ) : (
            <>
              <CorrectionsSection />
              {flagged.length > 0 ? (
                <SectionCard title={`Batidas para revisar · últimos ${REVIEW_DAYS} dias (${flagged.length})`}>
                  <ul className="divide-y divide-foreground/15">
                    {flagged.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{e.employees?.full_name ?? "Colaborador"}</span>
                          <span className="meta-mono">
                            {label(ENTRY_TYPE_LABEL, e.entry_type)} · {dateTimeFmt(e.server_time)}
                            {e.distance_meters != null ? ` · ${Math.round(e.distance_meters)} m` : ""}
                          </span>
                        </span>
                        <StatusBadge tone="warn">{label(GEO_STATUS_LABEL, e.geo_status)}</StatusBadge>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}
            </>
          )}

          <SectionCard
            title="Últimas batidas de hoje"
            action={
              <Link to="/ponto/registros" className="text-sm font-semibold underline">
                Ver todas
              </Link>
            }
          >
            {todays.length === 0 ? (
              <EmptyState title="Nenhuma batida hoje" />
            ) : (
              <ul className="divide-y divide-foreground/15">
                {todays.slice(0, 10).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.employees?.full_name ?? "Colaborador"}</span>
                      <span className="meta-mono">
                        {label(ENTRY_TYPE_LABEL, e.entry_type)} · {timeFmt(e.server_time)}
                      </span>
                    </span>
                    <StatusBadge tone={needsReview(e) ? "warn" : "ok"}>{label(GEO_STATUS_LABEL, e.geo_status)}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </>
  );
}

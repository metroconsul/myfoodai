import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState, StatCard } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { addDays, isoDate, startOfWeek, minutesToHours, dateTimeFmt } from "@/lib/format";
import { AlertTriangle, Clock, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/schedule-compliance")({
  head: () => ({
    meta: [
      { title: `Conflitos de escala — ${BRAND_NAME}` },
      { name: "description", content: "Sobreposições, descanso insuficiente e excesso de carga semanal." },
      { property: "og:title", content: `Conflitos de escala — ${BRAND_NAME}` },
      { property: "og:description", content: "Verificação de conformidade das escalas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompliancePage,
});

const MIN_REST_MINUTES = 11 * 60;
const WEEKLY_LIMIT_MINUTES = 44 * 60;

function CompliancePage() {
  const { activeUnitId } = useWorkspace();
  const week = startOfWeek(new Date());
  const periodStart = isoDate(week);
  const periodEnd = isoDate(addDays(week, 6));

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ["compliance", activeUnitId, periodStart],
    enabled: !!activeUnitId,
    queryFn: async () =>
      (
        await supabase
          .from("schedule_blocks")
          .select("id, employee_id, start_at, end_at, work_date, employees(full_name)")
          .eq("unit_id", activeUnitId!)
          .gte("work_date", periodStart)
          .lte("work_date", periodEnd)
          .order("start_at")
      ).data ?? [],
  });

  const issues = useMemo(() => {
    const byEmployee = new Map<string, typeof blocks>();
    for (const b of blocks) {
      const list = byEmployee.get(b.employee_id) ?? [];
      list.push(b);
      byEmployee.set(b.employee_id, list);
    }

    const overlaps: { name: string; detail: string }[] = [];
    const rests: { name: string; detail: string }[] = [];
    const overloads: { name: string; detail: string }[] = [];

    for (const [, list] of byEmployee) {
      const name = (list[0]?.employees as { full_name: string } | null)?.full_name ?? "Colaborador";
      const sorted = [...list].sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );
      let total = 0;
      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i]!;
        total += (new Date(cur.end_at).getTime() - new Date(cur.start_at).getTime()) / 60000;
        const next = sorted[i + 1];
        if (!next) continue;
        const gap = (new Date(next.start_at).getTime() - new Date(cur.end_at).getTime()) / 60000;
        if (gap < 0) {
          overlaps.push({ name, detail: `Sobreposição em ${dateTimeFmt(next.start_at)}` });
        } else if (gap < MIN_REST_MINUTES) {
          rests.push({ name, detail: `Descanso de ${minutesToHours(gap)} antes de ${dateTimeFmt(next.start_at)}` });
        }
      }
      if (total > WEEKLY_LIMIT_MINUTES) {
        overloads.push({ name, detail: `${minutesToHours(total)} planejadas na semana` });
      }
    }
    return { overlaps, rests, overloads };
  }, [blocks]);

  const groups = [
    { title: "Sobreposição de turnos", items: issues.overlaps, icon: <AlertTriangle className="size-5" /> },
    { title: "Descanso abaixo de 11h", items: issues.rests, icon: <Clock className="size-5" /> },
    { title: "Carga semanal acima de 44h", items: issues.overloads, icon: <Users className="size-5" /> },
  ];

  return (
    <>
      <PageHeader
        title="Conflitos de escala"
        description={`Verificação da semana de ${periodStart} a ${periodEnd}.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map((g) => (
          <StatCard
            key={g.title}
            label={g.title}
            value={g.items.length}
            tone={g.items.length ? "warning" : "success"}
            icon={g.icon}
          />
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Analisando escalas…</p>
        ) : (
          groups.map((g) => (
            <SectionCard key={g.title} title={g.title}>
              {g.items.length === 0 ? (
                <EmptyState title="Nenhum conflito nesta categoria" />
              ) : (
                <ul className="divide-y-2 divide-foreground">
                  {g.items.map((i, idx) => (
                    <li key={`${i.name}-${idx}`} className="flex justify-between py-2 text-sm">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-muted-foreground">{i.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          ))
        )}
      </div>
    </>
  );
}

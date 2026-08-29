import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { portalSchedule } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { addDays, dateFmt, isoDate, startOfWeek, timeFmt, minutesToHours } from "@/lib/format";
import { EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/escala")({
  head: () => ({
    meta: [
      { title: `Minha escala — ${BRAND_NAME}` },
      { name: "description", content: "Consulte seus turnos publicados por semana." },
      { property: "og:title", content: `Minha escala — ${BRAND_NAME}` },
      { property: "og:description", content: "Turnos publicados do colaborador." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalSchedulePage,
});

function PortalSchedulePage() {
  const { token, ready } = usePortalSession();
  const fetchSchedule = useServerFn(portalSchedule);
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    if (ready && !token) navigate({ to: "/portal/login", replace: true });
  }, [ready, token, navigate]);

  const from = isoDate(weekStart);
  const to = isoDate(addDays(weekStart, 6));

  const { data, isLoading } = useQuery({
    queryKey: ["portal-schedule", token, from, to],
    enabled: !!token,
    queryFn: () => fetchSchedule({ data: { token: token!, from, to } }),
  });

  const blocks = data && !("error" in data) ? data.blocks : [];
  const totalMinutes = blocks.reduce(
    (acc, b) => acc + Math.max(0, (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000),
    0,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Minha escala</h1>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          Semana anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          {dateFmt(from)} — {dateFmt(to)}
        </span>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Próxima
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">Total previsto: {minutesToHours(totalMinutes)}</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : blocks.length === 0 ? (
        <EmptyState
          title="Sem turnos nesta semana"
          description="Somente escalas publicadas aparecem aqui."
        />
      ) : (
        <ul className="space-y-2">
          {blocks.map((b) => (
            <li key={b.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{dateFmt(b.work_date)}</span>
                <span className="text-sm text-muted-foreground">
                  {timeFmt(b.start_at)} – {timeFmt(b.end_at)}
                </span>
              </div>
              {(b.shifts as { name: string } | null)?.name ? (
                <p className="mt-1 text-xs text-muted-foreground">{(b.shifts as { name: string }).name}</p>
              ) : null}
              {b.notes ? <p className="mt-1 text-xs text-muted-foreground">{b.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

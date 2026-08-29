import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { portalSchedule } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { addDays, dateFmt, isoDate, startOfWeek, timeFmt, minutesToHours } from "@/lib/format";
import {
  PortalButton,
  PortalCard,
  PortalChip,
  PortalEmpty,
  PortalLabel,
  PortalLoading,
} from "@/components/portal-ui";
import { cn } from "@/lib/utils";

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
  const [selected, setSelected] = useState<string>(() => isoDate(new Date()));

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

  const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i)));

  return (
    <div className="space-y-5">
      <PortalCard className="p-5">
        <PortalLabel>Semana</PortalLabel>
        <p className="display-type mt-1 text-xl">
          {dateFmt(from)} — {dateFmt(to)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Total previsto: {minutesToHours(totalMinutes)}</p>
        <div className="mt-4 flex gap-2">
          <PortalButton
            variant="secondary"
            className="min-h-11 flex-1 px-3 text-xs"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            Semana anterior
          </PortalButton>
          <PortalButton
            variant="dark"
            className="min-h-11 flex-1 px-3 text-xs"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            Próxima semana
          </PortalButton>
        </div>
      </PortalCard>

      {isLoading ? (
        <PortalLoading />
      ) : blocks.length === 0 ? (
        <PortalEmpty
          title="Ainda não há uma escala publicada para este período."
          description="Quando a gestão publicar sua escala, ela aparecerá aqui."
        />
      ) : (
        <ul className="space-y-3">
          {days.map((day) => {
            const dayBlocks = blocks.filter((b) => b.work_date === day);
            const isSelected = selected === day;
            return (
              <li key={day}>
                <button
                  type="button"
                  aria-expanded={isSelected}
                  onClick={() => setSelected(isSelected ? "" : day)}
                  className={cn(
                    "portal-press w-full rounded-[16px] border-2 border-foreground p-4 text-left shadow-[2px_2px_0_var(--ink)]",
                    isSelected ? "bg-accent text-accent-foreground" : "bg-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold">{dateFmt(day)}</span>
                    <PortalChip tone={dayBlocks.length ? "ink" : "paper"}>
                      {dayBlocks.length ? "Confirmado" : "Folga"}
                    </PortalChip>
                  </div>
                  {isSelected ? (
                    <div className="mt-3 space-y-2">
                      {dayBlocks.length === 0 ? (
                        <p className="text-sm">Nenhuma informação disponível para este dia.</p>
                      ) : (
                        dayBlocks.map((b) => (
                          <div
                            key={b.id}
                            className="rounded-[12px] border-2 border-foreground bg-card p-3 text-sm text-foreground"
                          >
                            <p className="font-bold">
                              {timeFmt(b.start_at)} – {timeFmt(b.end_at)}
                            </p>
                            {(b.shifts as { name: string } | null)?.name ? (
                              <p className="text-xs text-muted-foreground">
                                {(b.shifts as { name: string }).name}
                              </p>
                            ) : null}
                            {b.notes ? <p className="mt-1 text-xs text-muted-foreground">{b.notes}</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Clock } from "lucide-react";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui-kit";
import { useWorkspace } from "@/hooks/use-workspace";
import { getFixedSchedule, setFixedScheduleActive } from "@/lib/fixed-schedule.functions";
import { cn } from "@/lib/utils";
import { EscalaSemana } from "../components/escala-semana";
import { HorarioPadrao, type FixedRow } from "../components/horario-padrao";
import { HorariosProntos } from "../components/horarios-prontos";

type Mode = "todos" | "semana";

/**
 * Escalas numa tela só. A unidade escolhe como a equipe trabalha:
 * - "todos": horário padrão (jornada fixa) para todos, configurado uma vez;
 * - "semana": escala por semana, por pessoa (dia vazio = folga). Nesse modo o horário padrão fica desligado,
 *   senão ele preencheria sozinho os dias de folga.
 * O plano Começo só tem o horário padrão.
 */
export function EscalasPage() {
  const { activeUnitId, hasFeature } = useWorkspace();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getFixedSchedule);
  const setActiveFn = useServerFn(setFixedScheduleActive);
  const canWeekly = hasFeature("schedules_advanced");
  const canFixed = hasFeature("fixed_schedule");
  const [choosing, setChoosing] = useState<Mode | null>(null);

  const fixed = useQuery({
    queryKey: ["ponto", "fixed", activeUnitId],
    enabled: Boolean(activeUnitId) && canFixed,
    queryFn: () => getFn({ data: { unitId: activeUnitId! } }),
  });
  const row = (fixed.data?.schedule ?? null) as (FixedRow & { active?: boolean }) | null;

  const toggle = useMutation({
    mutationFn: (active: boolean) => setActiveFn({ data: { unitId: activeUnitId!, active } }),
    onSuccess: (_, active) => {
      setChoosing(null);
      toast.success(active ? "Agora todos seguem o horário padrão." : "Agora a escala é feita por semana.");
      void queryClient.invalidateQueries({ queryKey: ["ponto"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível mudar o modo."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;
  if (fixed.isLoading) return <LoadingState />;

  const saved: Mode = !canWeekly || row?.active ? "todos" : "semana";
  const mode = choosing ?? saved;

  function choose(next: Mode) {
    if (next === saved) return setChoosing(null);
    if (next === "semana") {
      if (row?.active && !window.confirm("Mudar para escala por semana? O horário padrão deixa de preencher os dias sozinho; dia sem horário vira folga.")) return;
      if (row?.active) return toggle.mutate(false);
      return setChoosing("semana");
    }
    // "todos": reativa o horário salvo; se ainda não existe, mostra o formulário (ativa ao salvar).
    if (row) return toggle.mutate(true);
    setChoosing("todos");
  }

  return (
    <>
      <PageHeader title="Escalas" description="Quando cada pessoa trabalha. O cartão de ponto usa estes horários para calcular atrasos e faltas." />

      {canWeekly && canFixed ? (
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Como a equipe trabalha">
          <ModeOption
            active={mode === "todos"}
            icon={<Clock className="size-5" />}
            title="Todos no mesmo horário"
            text="Ex.: segunda a sexta, 08:00 às 17:00. Configura uma vez e pronto."
            onClick={() => choose("todos")}
            disabled={toggle.isPending}
          />
          <ModeOption
            active={mode === "semana"}
            icon={<CalendarDays className="size-5" />}
            title="Escala por semana"
            text="Cada pessoa com seu horário e suas folgas, semana a semana."
            onClick={() => choose("semana")}
            disabled={toggle.isPending}
          />
        </div>
      ) : null}

      {mode === "todos" ? (
        canFixed ? (
          <HorarioPadrao unitId={activeUnitId} current={row} />
        ) : (
          <EmptyState title="O plano da empresa não inclui escalas" />
        )
      ) : (
        <>
          <EscalaSemana unitId={activeUnitId} />
          <HorariosProntos unitId={activeUnitId} />
        </>
      )}
    </>
  );
}

function ModeOption(props: { active: boolean; icon: React.ReactNode; title: string; text: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.active}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        "flex items-start gap-3 rounded-[12px] border-2 border-foreground p-4 text-left",
        props.active ? "bg-accent shadow-[3px_3px_0_var(--ink)]" : "bg-card hover:bg-secondary",
      )}
    >
      <span className="mt-0.5">{props.icon}</span>
      <span>
        <span className="block font-semibold">{props.title}</span>
        <span className="text-sm text-muted-foreground">{props.text}</span>
      </span>
    </button>
  );
}

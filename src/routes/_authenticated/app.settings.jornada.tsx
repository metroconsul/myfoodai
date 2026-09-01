import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, SectionCard, LoadingState, ErrorState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { TimeInputBR } from "@/components/ui/br-inputs";
import { useWorkspace } from "@/hooks/use-workspace";
import { getFixedSchedule, saveFixedSchedule } from "@/lib/fixed-schedule.functions";

export const Route = createFileRoute("/_authenticated/app/settings/jornada")({
  head: () => ({
    meta: [
      { title: `Jornada fixa — ${BRAND_NAME}` },
      {
        name: "description",
        content:
          "Configure os dias da semana, o horário de entrada e saída e o intervalo da jornada fixa da unidade.",
      },
      { property: "og:title", content: `Jornada fixa — ${BRAND_NAME}` },
      {
        property: "og:description",
        content: "Uma única jornada fixa por unidade, usada como previsão no cartão de ponto.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FixedSchedulePage,
});

const WEEKDAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

function FixedSchedulePage() {
  const { activeUnitId, units } = useWorkspace();
  const queryClient = useQueryClient();
  const unitId = activeUnitId ?? units[0]?.id ?? null;

  const scheduleQuery = useQuery({
    queryKey: ["fixed-schedule", unitId],
    queryFn: () => getFixedSchedule({ data: { unitId: unitId! } }),
    enabled: Boolean(unitId),
  });

  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");

  useEffect(() => {
    const s = scheduleQuery.data?.schedule;
    if (!s) return;
    setWeekdays(s.weekdays ?? [1, 2, 3, 4, 5]);
    setStartTime((s.start_time ?? "").slice(0, 5));
    setEndTime((s.end_time ?? "").slice(0, 5));
    setHasBreak(Boolean(s.break_start && s.break_end));
    setBreakStart((s.break_start ?? "").slice(0, 5));
    setBreakEnd((s.break_end ?? "").slice(0, 5));
  }, [scheduleQuery.data]);

  const save = useMutation({
    mutationFn: async () =>
      saveFixedSchedule({
        data: {
          unitId: unitId!,
          weekdays,
          startTime,
          endTime,
          breakStart: hasBreak ? breakStart : null,
          breakEnd: hasBreak ? breakEnd : null,
        },
      }),
    onSuccess: () => {
      toast.success("Jornada fixa salva.");
      queryClient.invalidateQueries({ queryKey: ["fixed-schedule"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a jornada."),
  });

  if (!unitId) return <ErrorState title="Cadastre uma unidade para configurar a jornada" />;
  if (scheduleQuery.isLoading) return <LoadingState rows={4} label="Carregando jornada…" />;
  if (scheduleQuery.isError)
    return (
      <ErrorState
        title="Não foi possível carregar a jornada"
        action={<Button onClick={() => scheduleQuery.refetch()}>Tentar novamente</Button>}
      />
    );

  const valid =
    weekdays.length > 0 &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) &&
    (!hasBreak ||
      (/^([01]\d|2[0-3]):[0-5]\d$/.test(breakStart) && /^([01]\d|2[0-3]):[0-5]\d$/.test(breakEnd)));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configurações"
        title="Jornada fixa"
        description="Uma única jornada por unidade. O cartão de ponto usa estes horários como previsão para calcular atrasos, faltas e horas registradas."
        actions={
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar jornada"}
          </Button>
        }
      />

      <SectionCard title="Dias de trabalho" description="Marque os dias em que a equipe trabalha.">
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-2 rounded-[10px] border-2 border-foreground bg-card px-3 py-2 shadow-[2px_2px_0_var(--ink)]"
            >
              <Checkbox
                checked={weekdays.includes(day.value)}
                onCheckedChange={(checked) =>
                  setWeekdays((prev) =>
                    checked
                      ? [...prev, day.value].sort((a, b) => a - b)
                      : prev.filter((d) => d !== day.value),
                  )
                }
              />
              <span className="text-sm font-semibold">{day.label}</span>
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Horário"
        description="Informe o horário real praticado pela unidade. O sistema não presume nenhum horário."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Entrada</Label>
            <TimeInputBR value={startTime} onValueChange={setStartTime} />
          </div>
          <div className="space-y-2">
            <Label>Saída</Label>
            <TimeInputBR value={endTime} onValueChange={setEndTime} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Intervalo" description="Opcional. Descontado das horas previstas do dia.">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={hasBreak} onCheckedChange={setHasBreak} id="has-break" />
            <Label htmlFor="has-break">A jornada possui intervalo</Label>
          </div>
          {hasBreak ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Início do intervalo</Label>
                <TimeInputBR value={breakStart} onValueChange={setBreakStart} />
              </div>
              <div className="space-y-2">
                <Label>Fim do intervalo</Label>
                <TimeInputBR value={breakEnd} onValueChange={setBreakEnd} />
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

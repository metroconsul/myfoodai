import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BrTimeInput } from "@/components/ui/br-inputs";
import { saveFixedSchedule } from "@/lib/fixed-schedule.functions";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type FixedRow = {
  weekdays: number[] | null;
  start_time: string | null;
  end_time: string | null;
  break_start: string | null;
  break_end: string | null;
} | null;

/**
 * Horário padrão da unidade (jornada fixa): vale para todos os colaboradores.
 * O cartão de ponto usa estes horários para calcular atrasos, faltas e horas.
 */
export function HorarioPadrao({ unitId, current }: { unitId: string; current: FixedRow }) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveFixedSchedule);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");

  useEffect(() => {
    if (!current) return;
    setWeekdays(current.weekdays ?? [1, 2, 3, 4, 5]);
    setStart((current.start_time ?? "").slice(0, 5));
    setEnd((current.end_time ?? "").slice(0, 5));
    setHasBreak(Boolean(current.break_start && current.break_end));
    setBreakStart((current.break_start ?? "").slice(0, 5));
    setBreakEnd((current.break_end ?? "").slice(0, 5));
  }, [current]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          unitId,
          weekdays,
          startTime: start,
          endTime: end,
          breakStart: hasBreak ? breakStart : null,
          breakEnd: hasBreak ? breakEnd : null,
        },
      }),
    onSuccess: () => {
      toast.success("Horário salvo.");
      void queryClient.invalidateQueries({ queryKey: ["ponto", "fixed", unitId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar o horário."),
  });

  const valid =
    weekdays.length > 0 && HHMM.test(start) && HHMM.test(end) && (!hasBreak || (HHMM.test(breakStart) && HHMM.test(breakEnd)));

  return (
    <SectionCard title="Horário de todos">
      <div className="space-y-5">
        <div>
          <Label className="mb-2 block">Dias de trabalho</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const on = weekdays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setWeekdays((prev) => (on ? prev.filter((x) => x !== d.value) : [...prev, d.value]))}
                  className={cn(
                    "min-w-14 rounded-[8px] border-2 border-foreground px-3 py-2 text-sm font-semibold",
                    on ? "bg-accent shadow-[2px_2px_0_var(--ink)]" : "bg-card text-muted-foreground",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>Entrada</Label>
            <BrTimeInput value={start} onChange={setStart} className="w-28" />
          </div>
          <div className="space-y-1.5">
            <Label>Saída</Label>
            <BrTimeInput value={end} onChange={setEnd} className="w-28" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Switch checked={hasBreak} onCheckedChange={setHasBreak} /> Tem intervalo
          </label>
          {hasBreak ? (
            <>
              <div className="space-y-1.5">
                <Label>Intervalo de</Label>
                <BrTimeInput value={breakStart} onChange={setBreakStart} className="w-28" />
              </div>
              <div className="space-y-1.5">
                <Label>até</Label>
                <BrTimeInput value={breakEnd} onChange={setBreakEnd} className="w-28" />
              </div>
            </>
          ) : null}
        </div>
        <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
          {save.isPending ? "Salvando…" : "Salvar horário"}
        </Button>
      </div>
    </SectionCard>
  );
}

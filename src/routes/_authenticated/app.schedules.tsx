import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { WEEKDAYS, addDays, isoDate, startOfWeek, minutesToHours } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/schedules")({
  head: () => ({
    meta: [
      { title: `Escalas — ${BRAND_NAME}` },
      { name: "description", content: "Montagem semanal de escalas com múltiplos blocos por dia e publicação." },
      { property: "og:title", content: `Escalas — ${BRAND_NAME}` },
      { property: "og:description", content: "Escala semanal por colaborador e turno." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SchedulesPage,
});

function SchedulesPage() {
  const { company, activeUnitId, userId } = useWorkspace();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dialog, setDialog] = useState<{ date: string } | null>(null);
  const [blockForm, setBlockForm] = useState({ employee_id: "", shift_id: "", start: "08:00", end: "16:00" });

  const periodStart = isoDate(weekStart);
  const periodEnd = isoDate(addDays(weekStart, 6));

  const { data: schedule } = useQuery({
    queryKey: ["schedule", activeUnitId, periodStart],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .eq("unit_id", activeUnitId!)
        .eq("period_start", periodStart)
        .maybeSingle();
      return data;
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["schedule-blocks", schedule?.id],
    enabled: !!schedule?.id,
    queryFn: async () =>
      (
        await supabase
          .from("schedule_blocks")
          .select("*, employees(full_name), shifts(name, color)")
          .eq("schedule_id", schedule!.id)
          .order("start_at")
      ).data ?? [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () =>
      (
        await supabase
          .from("employees")
          .select("id, full_name")
          .eq("unit_id", activeUnitId!)
          .eq("employment_status", "ativo")
          .order("full_name")
      ).data ?? [],
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", activeUnitId],
    queryFn: async () => (await supabase.from("shifts").select("*").eq("active", true).order("start_time")).data ?? [],
  });

  const createSchedule = useMutation({
    mutationFn: async () => {
      if (!company || !activeUnitId) throw new Error("Selecione uma unidade.");
      const { error } = await supabase.from("schedules").insert({
        company_id: company.id,
        unit_id: activeUnitId,
        period_start: periodStart,
        period_end: periodEnd,
        name: `Semana de ${periodStart}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      toast.success("Escala criada como rascunho.");
    },
    onError: () => toast.error("Erro ao criar escala."),
  });

  const addBlock = useMutation({
    mutationFn: async () => {
      if (!company || !activeUnitId || !schedule || !dialog) throw new Error("Escala indisponível.");
      const start = new Date(`${dialog.date}T${blockForm.start}:00`);
      const end = new Date(`${dialog.date}T${blockForm.end}:00`);
      if (end <= start) end.setDate(end.getDate() + 1);
      const { error } = await supabase.from("schedule_blocks").insert({
        company_id: company.id,
        unit_id: activeUnitId,
        schedule_id: schedule.id,
        employee_id: blockForm.employee_id,
        shift_id: blockForm.shift_id || null,
        work_date: dialog.date,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDialog(null);
      queryClient.invalidateQueries({ queryKey: ["schedule-blocks"] });
      toast.success("Bloco adicionado.");
    },
    onError: () => toast.error("Erro ao adicionar bloco."),
  });

  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedule-blocks"] }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!schedule) return;
      const { error } = await supabase
        .from("schedules")
        .update({
          status: "publicada",
          published_at: new Date().toISOString(),
          published_by: userId,
          version: schedule.version + 1,
        })
        .eq("id", schedule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      toast.success("Escala publicada para a equipe.");
    },
    onError: () => toast.error("Erro ao publicar."),
  });

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const totalMinutes = blocks.reduce(
    (acc, b) => acc + (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000,
    0,
  );

  return (
    <>
      <PageHeader
        title="Escalas"
        description={`Semana de ${periodStart} a ${periodEnd} · ${minutesToHours(totalMinutes)} planejadas.`}
        actions={
          <>
            <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              Semana anterior
            </Button>
            <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Próxima semana
            </Button>
            {schedule ? (
              <Button onClick={() => publish.mutate()} disabled={schedule.status === "publicada"}>
                {schedule.status === "publicada" ? "Publicada" : "Publicar"}
              </Button>
            ) : (
              <Button onClick={() => createSchedule.mutate()}>Criar escala da semana</Button>
            )}
          </>
        }
      />

      {!schedule ? (
        <EmptyState
          title="Sem escala para esta semana"
          description="Crie a escala para começar a distribuir turnos entre os colaboradores."
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <StatusBadge tone={schedule.status === "publicada" ? "ok" : "warn"}>
              {schedule.status}
            </StatusBadge>
            <span className="text-xs text-muted-foreground">versão {schedule.version}</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-7">
            {days.map((day, i) => {
              const date = isoDate(day);
              const dayBlocks = blocks.filter((b) => b.work_date === date);
              return (
                <SectionCard key={date}>
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{WEEKDAYS[i]}</p>
                      <p className="text-xs text-muted-foreground">{day.getDate()}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Adicionar bloco em ${date}`}
                      onClick={() => setDialog({ date })}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {dayBlocks.map((b) => (
                      <li
                        key={b.id}
                        className="rounded-lg border-l-4 bg-secondary px-2 py-1.5 text-xs"
                        style={{ borderLeftColor: (b.shifts as { color: string } | null)?.color ?? "#F97316" }}
                      >
                        <span className="flex items-start justify-between gap-1">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {(b.employees as { full_name: string } | null)?.full_name}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(b.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              –
                              {new Date(b.end_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </span>
                          <button
                            onClick={() => removeBlock.mutate(b.id)}
                            aria-label="Remover bloco"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                    {dayBlocks.length === 0 ? (
                      <li className="text-xs text-muted-foreground">Sem turnos</li>
                    ) : null}
                  </ul>
                </SectionCard>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo bloco — {dialog?.date}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              addBlock.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="employee">Colaborador</Label>
              <Select
                value={blockForm.employee_id}
                onValueChange={(v) => setBlockForm({ ...blockForm, employee_id: v })}
              >
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shift">Turno (opcional)</Label>
              <Select
                value={blockForm.shift_id}
                onValueChange={(v) => {
                  const shift = shifts.find((s) => s.id === v);
                  setBlockForm({
                    ...blockForm,
                    shift_id: v,
                    start: shift ? shift.start_time.slice(0, 5) : blockForm.start,
                    end: shift ? shift.end_time.slice(0, 5) : blockForm.end,
                  });
                }}
              >
                <SelectTrigger id="shift">
                  <SelectValue placeholder="Personalizado" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="bstart">Início</Label>
                <Input
                  id="bstart"
                  type="time"
                  value={blockForm.start}
                  onChange={(e) => setBlockForm({ ...blockForm, start: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bend">Fim</Label>
                <Input
                  id="bend"
                  type="time"
                  value={blockForm.end}
                  onChange={(e) => setBlockForm({ ...blockForm, end: e.target.value })}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={!blockForm.employee_id || addBlock.isPending}>
              Adicionar bloco
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

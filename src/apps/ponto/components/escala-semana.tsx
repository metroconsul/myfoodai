import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, AlertTriangle } from "lucide-react";
import { EmptyState, LoadingState, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BrTimeInput } from "@/components/ui/br-inputs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { minutesToHours, timeFmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  blockTimes,
  copyFromPreviousWeek,
  minutesOf,
  mondayOf,
  shiftWeek,
  weekDates,
  weekWarnings,
  type Warning,
} from "../lib/schedule-rules";
import { localYmd } from "../lib/dates";

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

type Editing = { employeeId: string; name: string; date: string; dayIndex: number };

/**
 * Escala por semana: colaboradores nas linhas, dias nas colunas. Clique num dia para definir o horário ou folga.
 * Dia sem horário = folga. "Copiar semana anterior" substitui os modelos; avisos substituem a tela de conflitos.
 */
export function EscalaSemana({ unitId }: { unitId: string }) {
  const { company, userId } = useWorkspace();
  const queryClient = useQueryClient();
  const [monday, setMonday] = useState(() => mondayOf());
  const dates = useMemo(() => weekDates(monday), [monday]);
  const sunday = dates[6]!;
  const key = ["ponto", "escala", unitId, monday];
  const [editing, setEditing] = useState<Editing | null>(null);

  const data = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [employees, schedule, blocks, shifts] = await Promise.all([
        supabase.from("employees").select("id, full_name").eq("unit_id", unitId).eq("employment_status", "ativo").order("full_name"),
        supabase
          .from("schedules")
          .select("id, status, version")
          .eq("unit_id", unitId)
          .eq("source", "manual")
          .eq("period_start", monday)
          .order("created_at")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("schedule_blocks")
          .select("id, employee_id, work_date, start_at, end_at, shift_id")
          .eq("unit_id", unitId)
          .gte("work_date", monday)
          .lte("work_date", sunday)
          .order("start_at"),
        supabase.from("shifts").select("id, name, start_time, end_time").eq("active", true).order("start_time"),
      ]);
      const error = employees.error ?? schedule.error ?? blocks.error ?? shifts.error;
      if (error) throw error;
      return {
        employees: employees.data ?? [],
        schedule: schedule.data,
        blocks: blocks.data ?? [],
        shifts: shifts.data ?? [],
      };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ponto", "escala", unitId] });
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");

  /** Escala da semana (rascunho) criada na primeira alteração. */
  async function ensureSchedule(): Promise<string> {
    const current = data.data?.schedule;
    if (current) return current.id;
    const { data: created, error } = await supabase
      .from("schedules")
      .insert({ company_id: company!.id, unit_id: unitId, period_start: monday, period_end: sunday, name: `Semana de ${ddmm(monday)}` })
      .select("id")
      .single();
    if (error || !created) throw new Error("Não foi possível criar a escala da semana.");
    return created.id;
  }

  const saveDay = useMutation({
    mutationFn: async (v: { employeeId: string; dates: string[]; start: string; end: string; shiftId: string | null }) => {
      const scheduleId = await ensureSchedule();
      for (const date of v.dates) {
        const times = blockTimes(date, v.start, v.end);
        const existing = (data.data?.blocks ?? []).filter((b) => b.employee_id === v.employeeId && b.work_date === date);
        // Atualiza o horário existente (mantém o vínculo com as batidas); só cria quando o dia estava vazio.
        if (existing[0]) {
          const { error } = await supabase
            .from("schedule_blocks")
            .update({ ...times, shift_id: v.shiftId, schedule_id: scheduleId })
            .eq("id", existing[0].id);
          if (error) throw error;
          const extra = existing.slice(1).map((b) => b.id);
          if (extra.length) await supabase.from("schedule_blocks").delete().in("id", extra);
        } else {
          const { error } = await supabase.from("schedule_blocks").insert({
            company_id: company!.id,
            unit_id: unitId,
            schedule_id: scheduleId,
            employee_id: v.employeeId,
            work_date: date,
            shift_id: v.shiftId,
            ...times,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      setEditing(null);
      void refresh();
    },
    onError: fail,
  });

  const dayOff = useMutation({
    mutationFn: async (v: { employeeId: string; date: string }) => {
      const { error } = await supabase.from("schedule_blocks").delete().eq("employee_id", v.employeeId).eq("work_date", v.date).eq("unit_id", unitId);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(null);
      void refresh();
    },
    onError: fail,
  });

  const copyPrevious = useMutation({
    mutationFn: async () => {
      const prevMonday = shiftWeek(monday, -1);
      const { data: prev, error } = await supabase
        .from("schedule_blocks")
        .select("id, employee_id, work_date, start_at, end_at")
        .eq("unit_id", unitId)
        .gte("work_date", prevMonday)
        .lte("work_date", weekDates(prevMonday)[6]!);
      if (error) throw error;
      const active = new Set((data.data?.employees ?? []).map((e) => e.id));
      const rows = copyFromPreviousWeek((prev ?? []).filter((b) => active.has(b.employee_id)), data.data?.blocks ?? []);
      if (rows.length === 0) return 0;
      const scheduleId = await ensureSchedule();
      const { error: insErr } = await supabase
        .from("schedule_blocks")
        .insert(rows.map((r) => ({ ...r, company_id: company!.id, unit_id: unitId, schedule_id: scheduleId })));
      if (insErr) throw insErr;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(n ? `${n} horário(s) copiados da semana anterior.` : "Nada para copiar: a semana anterior está vazia ou os dias já estão preenchidos.");
      void refresh();
    },
    onError: fail,
  });

  const publish = useMutation({
    mutationFn: async () => {
      const s = data.data?.schedule;
      if (!s) throw new Error("Defina pelo menos um horário antes de publicar.");
      const { error } = await supabase
        .from("schedules")
        .update({ status: "publicada", published_at: new Date().toISOString(), published_by: userId, version: s.version + 1 })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escala publicada. A equipe já vê no Portal.");
      void refresh();
    },
    onError: fail,
  });

  const d = data.data;
  const names = new Map((d?.employees ?? []).map((e) => [e.id, e.full_name]));
  const warnings = weekWarnings(d?.blocks ?? []);
  const published = d?.schedule?.status === "publicada";

  return (
    <SectionCard title="Escala da semana">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setMonday(shiftWeek(monday, -1))} aria-label="Semana anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-36 text-center text-sm font-semibold">
          {ddmm(monday)} a {ddmm(sunday)}
        </span>
        <Button variant="outline" size="icon" onClick={() => setMonday(shiftWeek(monday, 1))} aria-label="Próxima semana">
          <ChevronRight className="size-4" />
        </Button>
        {monday !== mondayOf() ? (
          <Button variant="ghost" size="sm" onClick={() => setMonday(mondayOf())}>
            Esta semana
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => copyPrevious.mutate()} disabled={copyPrevious.isPending || !d}>
            <Copy className="mr-2 size-4" aria-hidden /> Copiar semana anterior
          </Button>
          {d?.schedule && !published ? (
            <Button onClick={() => publish.mutate()} disabled={publish.isPending}>
              Publicar para a equipe
            </Button>
          ) : null}
        </div>
      </div>

      {d?.schedule ? (
        <p className="mb-3 flex items-center gap-2 text-sm">
          <StatusBadge tone={published ? "ok" : "warn"}>{published ? "Publicada" : "Rascunho"}</StatusBadge>
          {published ? "A equipe vê esta semana no Portal." : "A equipe ainda não vê esta semana. Publique quando terminar."}
        </p>
      ) : null}

      {data.isLoading ? (
        <LoadingState />
      ) : data.isError ? (
        <EmptyState title="Não foi possível carregar a escala" />
      ) : d!.employees.length === 0 ? (
        <EmptyState title="Nenhum colaborador ativo nesta unidade" description="Cadastre a equipe na aba Equipe." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card text-left font-semibold">Colaborador</th>
                {dates.map((date, i) => (
                  <th key={date} className="font-semibold">
                    {DAY_NAMES[i]} <span className="meta-mono">{ddmm(date)}</span>
                  </th>
                ))}
                <th className="text-right font-semibold">Semana</th>
              </tr>
            </thead>
            <tbody>
              {d!.employees.map((emp) => {
                const mine = d!.blocks.filter((b) => b.employee_id === emp.id);
                return (
                  <tr key={emp.id}>
                    <td className="sticky left-0 max-w-40 truncate bg-card pr-2 font-medium">{emp.full_name}</td>
                    {dates.map((date, i) => {
                      const day = mine.filter((b) => b.work_date === date);
                      return (
                        <td key={date}>
                          <button
                            type="button"
                            onClick={() => setEditing({ employeeId: emp.id, name: emp.full_name, date, dayIndex: i })}
                            className={cn(
                              "w-full rounded-[8px] border-2 px-1 py-2 text-center text-xs font-semibold",
                              day.length ? "border-foreground bg-accent/60 hover:bg-accent" : "border-dashed border-foreground/30 text-muted-foreground hover:border-foreground",
                            )}
                          >
                            {day.length ? day.map((b) => `${timeFmt(b.start_at)}–${timeFmt(b.end_at)}`).join(" · ") : "Folga"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="meta-mono text-right">{minutesToHours(mine.reduce((acc, b) => acc + minutesOf(b), 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {warnings.length > 0 ? <Avisos warnings={warnings} names={names} /> : null}

      <DayDialog
        editing={editing}
        shifts={d?.shifts ?? []}
        current={editing ? (d?.blocks ?? []).find((b) => b.employee_id === editing.employeeId && b.work_date === editing.date) : undefined}
        weekDates={dates}
        busy={saveDay.isPending || dayOff.isPending}
        onClose={() => setEditing(null)}
        onSave={(v) => saveDay.mutate(v)}
        onDayOff={(v) => dayOff.mutate(v)}
      />
    </SectionCard>
  );
}

function Avisos({ warnings, names }: { warnings: Warning[]; names: Map<string, string> }) {
  const text = (w: Warning) => {
    const when = w.at ? ` (${ddmm(localYmd(new Date(w.at)))})` : "";
    if (w.kind === "sobreposicao") return `horários se sobrepõem${when}`;
    if (w.kind === "descanso") return `só ${minutesToHours(w.minutes)} de descanso entre um dia e outro${when}; o mínimo é 11h`;
    return `${minutesToHours(w.minutes)} na semana; o limite é 44h`;
  };
  return (
    <div className="mt-4 rounded-[10px] border-2 border-foreground bg-warning/20 p-3 text-sm">
      <p className="mb-1 flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4" aria-hidden /> Avisos da semana
      </p>
      <ul className="list-disc pl-5">
        {warnings.map((w, i) => (
          <li key={i}>
            <strong>{names.get(w.employeeId) ?? "Colaborador"}</strong>: {text(w)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayDialog({
  editing,
  shifts,
  current,
  weekDates,
  busy,
  onClose,
  onSave,
  onDayOff,
}: {
  editing: Editing | null;
  shifts: { id: string; name: string; start_time: string; end_time: string }[];
  current: { start_at: string; end_at: string; shift_id: string | null } | undefined;
  weekDates: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (v: { employeeId: string; dates: string[]; start: string; end: string; shiftId: string | null }) => void;
  onDayOff: (v: { employeeId: string; date: string }) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);

  // Preenche o formulário ao abrir para um novo dia.
  const id = editing ? `${editing.employeeId}|${editing.date}` : null;
  if (id !== openFor) {
    setOpenFor(id);
    setStart(current ? timeFmt(current.start_at) : "");
    setEnd(current ? timeFmt(current.end_at) : "");
    setShiftId(current?.shift_id ?? null);
    setWeekdays(false);
  }

  const valid = HHMM.test(start) && HHMM.test(end) && start !== end;
  const dates = editing ? (weekdays ? weekDates.slice(0, 5) : [editing.date]) : [];

  return (
    <Dialog open={Boolean(editing)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing?.name} · {editing ? `${DAY_NAMES[editing.dayIndex]} ${ddmm(editing.date)}` : ""}
          </DialogTitle>
        </DialogHeader>
        {shifts.length > 0 ? (
          <div className="space-y-1.5">
            <Label>Horários prontos</Label>
            <div className="flex flex-wrap gap-2">
              {shifts.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={shiftId === s.id ? "default" : "outline"}
                  onClick={() => {
                    setShiftId(s.id);
                    setStart(s.start_time.slice(0, 5));
                    setEnd(s.end_time.slice(0, 5));
                  }}
                >
                  {s.name} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>Entrada</Label>
            <BrTimeInput
              value={start}
              onChange={(v) => {
                setStart(v);
                setShiftId(null);
              }}
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Saída</Label>
            <BrTimeInput
              value={end}
              onChange={(v) => {
                setEnd(v);
                setShiftId(null);
              }}
              className="w-28"
            />
          </div>
        </div>
        {editing && editing.dayIndex < 5 ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={weekdays} onCheckedChange={(c) => setWeekdays(c === true)} /> Usar este horário de segunda a sexta
          </label>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <Button
            variant="outline"
            disabled={busy || !current}
            onClick={() => editing && onDayOff({ employeeId: editing.employeeId, date: editing.date })}
          >
            Marcar folga
          </Button>
          <Button disabled={busy || !valid} onClick={() => editing && onSave({ employeeId: editing.employeeId, dates, start, end, shiftId })}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

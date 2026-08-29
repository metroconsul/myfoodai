import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { WEEKDAYS, addDays, isoDate, startOfWeek } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/schedule-templates")({
  head: () => ({
    meta: [
      { title: `Modelos de escala — ${BRAND_NAME}` },
      { name: "description", content: "Modelos semanais reaproveitáveis para gerar escalas rapidamente." },
      { property: "og:title", content: `Modelos de escala — ${BRAND_NAME}` },
      { property: "og:description", content: "Padrões semanais de turnos por colaborador." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { company, activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const [templateName, setTemplateName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [item, setItem] = useState({ weekday: "0", shift_id: "", employee_id: "" });

  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await supabase.from("schedule_templates").select("*").order("name")).data ?? [],
  });
  const items = useQuery({
    queryKey: ["template-items", selected],
    enabled: !!selected,
    queryFn: async () =>
      (
        await supabase
          .from("schedule_template_items")
          .select("*, shifts(name, start_time, end_time), employees(full_name)")
          .eq("template_id", selected!)
          .order("weekday")
      ).data ?? [],
  });
  const shifts = useQuery({
    queryKey: ["shifts", activeUnitId],
    queryFn: async () => (await supabase.from("shifts").select("*").eq("active", true).order("start_time")).data ?? [],
  });
  const employees = useQuery({
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

  const createTemplate = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      const { error } = await supabase
        .from("schedule_templates")
        .insert({ company_id: company.id, unit_id: activeUnitId, name: templateName.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setTemplateName("");
      toast.success("Modelo criado.");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: () => toast.error("Erro ao criar modelo."),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione um modelo.");
      const { error } = await supabase.from("schedule_template_items").insert({
        template_id: selected,
        weekday: Number(item.weekday),
        shift_id: item.shift_id,
        employee_id: item.employee_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-items"] });
      toast.success("Item adicionado ao modelo.");
    },
    onError: () => toast.error("Erro ao adicionar item."),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_template_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["template-items"] }),
  });

  const applyTemplate = useMutation({
    mutationFn: async () => {
      if (!company || !activeUnitId || !selected) throw new Error("Selecione um modelo.");
      const week = startOfWeek(addDays(new Date(), 7));
      const periodStart = isoDate(week);
      const periodEnd = isoDate(addDays(week, 6));

      const { data: schedule, error: scheduleError } = await supabase
        .from("schedules")
        .upsert(
          {
            company_id: company.id,
            unit_id: activeUnitId,
            period_start: periodStart,
            period_end: periodEnd,
            template_id: selected,
            source: "template",
            name: `Semana de ${periodStart}`,
          },
          { onConflict: "unit_id,period_start" },
        )
        .select("id")
        .single();
      if (scheduleError || !schedule) throw scheduleError ?? new Error("Erro ao criar escala.");

      const rows = (items.data ?? [])
        .filter((it) => it.employee_id)
        .map((it) => {
          const day = addDays(week, it.weekday);
          const shift = it.shifts as { start_time: string; end_time: string } | null;
          const start = new Date(`${isoDate(day)}T${shift?.start_time ?? "08:00:00"}`);
          const end = new Date(`${isoDate(day)}T${shift?.end_time ?? "16:00:00"}`);
          if (end <= start) end.setDate(end.getDate() + 1);
          return {
            company_id: company.id,
            unit_id: activeUnitId,
            schedule_id: schedule.id,
            employee_id: it.employee_id!,
            shift_id: it.shift_id,
            work_date: isoDate(day),
            start_at: start.toISOString(),
            end_at: end.toISOString(),
          };
        });
      if (rows.length === 0) throw new Error("O modelo não tem itens com colaborador definido.");
      const { error } = await supabase.from("schedule_blocks").insert(rows);
      if (error) throw error;
      return periodStart;
    },
    onSuccess: (periodStart) => toast.success(`Escala gerada para a semana de ${periodStart}.`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao aplicar modelo."),
  });

  return (
    <>
      <PageHeader
        title="Modelos semanais"
        description="Monte um padrão de turnos e gere a escala da próxima semana em um clique."
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <SectionCard title="Modelos">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createTemplate.mutate();
            }}
          >
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ex.: Padrão salão"
              maxLength={80}
              required
              aria-label="Nome do modelo"
            />
            <Button type="submit">Add</Button>
          </form>
          <ul className="mt-4 space-y-1">
            {(templates.data ?? []).map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelected(t.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selected === t.id ? "bg-accent text-accent-foreground" : "hover:bg-secondary"
                  }`}
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Itens do modelo">
          {!selected ? (
            <EmptyState title="Selecione um modelo" description="Escolha um modelo à esquerda para editar os itens." />
          ) : (
            <>
              <form
                className="grid gap-2 sm:grid-cols-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  addItem.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="weekday">Dia</Label>
                  <Select value={item.weekday} onValueChange={(v) => setItem({ ...item, weekday: v })}>
                    <SelectTrigger id="weekday">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d, i) => (
                        <SelectItem key={d} value={String(i)}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tshift">Turno</Label>
                  <Select value={item.shift_id} onValueChange={(v) => setItem({ ...item, shift_id: v })}>
                    <SelectTrigger id="tshift">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(shifts.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="temployee">Colaborador</Label>
                  <Select value={item.employee_id} onValueChange={(v) => setItem({ ...item, employee_id: v })}>
                    <SelectTrigger id="temployee">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {(employees.data ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={!item.shift_id}>
                    Adicionar
                  </Button>
                </div>
              </form>

              <ul className="mt-4 divide-y divide-border">
                {(items.data ?? []).map((it) => (
                  <li key={it.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {WEEKDAYS[it.weekday]} · {(it.shifts as { name: string } | null)?.name} ·{" "}
                      {(it.employees as { full_name: string } | null)?.full_name ?? "sem colaborador"}
                    </span>
                    <button
                      onClick={() => removeItem.mutate(it.id)}
                      aria-label="Remover item"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <Button className="mt-4" onClick={() => applyTemplate.mutate()} disabled={applyTemplate.isPending}>
                Gerar escala da próxima semana
              </Button>
            </>
          )}
        </SectionCard>
      </div>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/shifts")({
  head: () => ({
    meta: [
      { title: `Turnos — ${BRAND_NAME}` },
      { name: "description", content: "Turnos padrão da unidade, incluindo jornadas que atravessam a meia-noite." },
      { property: "og:title", content: `Turnos — ${BRAND_NAME}` },
      { property: "og:description", content: "Blocos de horário reutilizáveis nas escalas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ShiftsPage,
});

function ShiftsPage() {
  const { company, activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", start_time: "08:00", end_time: "16:00", color: "#F97316" });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", activeUnitId],
    queryFn: async () => (await supabase.from("shifts").select("*").order("start_time")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      const crosses = form.end_time <= form.start_time;
      const { error } = await supabase.from("shifts").insert({
        company_id: company.id,
        unit_id: activeUnitId,
        name: form.name.trim(),
        start_time: form.start_time,
        end_time: form.end_time,
        crosses_midnight: crosses,
        color: form.color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turno criado.");
      setForm({ ...form, name: "" });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: () => toast.error("Erro ao criar turno."),
  });

  return (
    <>
      <PageHeader title="Turnos" description="Modelos de horário reutilizados na montagem das escalas." />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <SectionCard title="Novo turno">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Cozinha noite"
                maxLength={80}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="start">Início</Label>
                <Input
                  id="start"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">Fim</Label>
                <Input
                  id="end"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color">Cor</Label>
              <Input
                id="color"
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-20 p-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending}>
              Criar turno
            </Button>
            {form.end_time <= form.start_time ? (
              <p className="text-xs text-warning-foreground">Este turno atravessa a meia-noite.</p>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard title="Turnos cadastrados">
          {shifts.length === 0 ? (
            <EmptyState title="Nenhum turno" description="Crie turnos para montar escalas mais rápido." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {shifts.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-[10px] border-2 border-foreground bg-card p-3">
                  <span className="size-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                    </span>
                  </span>
                  {s.crosses_midnight ? <StatusBadge tone="warn">vira o dia</StatusBadge> : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

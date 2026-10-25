import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrTimeInput } from "@/components/ui/br-inputs";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Horários prontos (tabela de turnos): atalhos como "Manhã 06:00–14:00" para preencher a escala com um clique. */
export function HorariosProntos({ unitId }: { unitId: string }) {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const shifts = useQuery({
    queryKey: ["ponto", "escala", unitId, "shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("id, name, start_time, end_time").eq("active", true).order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ponto", "escala", unitId] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shifts").insert({
        company_id: company!.id,
        unit_id: unitId,
        name: name.trim(),
        start_time: start,
        end_time: end,
        crosses_midnight: end <= start,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setStart("");
      setEnd("");
      void refresh();
    },
    onError: () => toast.error("Não foi possível salvar o horário."),
  });

  // Desativa em vez de apagar: escalas antigas continuam apontando para ele.
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shifts").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: () => toast.error("Não foi possível remover."),
  });

  const valid = name.trim() && HHMM.test(start) && HHMM.test(end) && start !== end;

  return (
    <SectionCard title="Horários prontos">
      <p className="mb-3 text-sm text-muted-foreground">Opcional. Aparecem como atalho ao preencher a escala.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {(shifts.data ?? []).length === 0 ? (
          <span className="text-sm text-muted-foreground">Nenhum ainda.</span>
        ) : (
          (shifts.data ?? []).map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-card py-1 pl-3 pr-1 text-sm">
              <strong>{s.name}</strong> {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
              <button
                type="button"
                className="rounded-full p-1 hover:bg-secondary"
                aria-label={`Remover ${s.name}`}
                onClick={() => remove.mutate(s.id)}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))
        )}
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) add.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="hp-name">Nome</Label>
          <Input id="hp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Manhã" className="w-36" />
        </div>
        <div className="space-y-1.5">
          <Label>Entrada</Label>
          <BrTimeInput value={start} onChange={setStart} className="w-24" />
        </div>
        <div className="space-y-1.5">
          <Label>Saída</Label>
          <BrTimeInput value={end} onChange={setEnd} className="w-24" />
        </div>
        <Button type="submit" variant="outline" disabled={!valid || add.isPending}>
          Adicionar
        </Button>
      </form>
    </SectionCard>
  );
}

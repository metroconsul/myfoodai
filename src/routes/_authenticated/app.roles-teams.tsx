import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const REGIMES: Enums<"regime_type">[] = ["6x1", "5x2", "12x36", "custom"];

export const Route = createFileRoute("/_authenticated/app/roles-teams")({
  head: () => ({
    meta: [
      { title: `Cargos e equipes — ${BRAND_NAME}` },
      { name: "description", content: "Cargos, equipes e regimes de trabalho usados nas escalas." },
      { property: "og:title", content: `Cargos e equipes — ${BRAND_NAME}` },
      { property: "og:description", content: "Estrutura de cargos, equipes e jornadas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RolesTeamsPage,
});

function RolesTeamsPage() {
  const { company, activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const [roleName, setRoleName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [regimeName, setRegimeName] = useState("");
  const [regimeType, setRegimeType] = useState<Enums<"regime_type">>("6x1");
  const [weeklyHours, setWeeklyHours] = useState("44");

  const roles = useQuery({
    queryKey: ["roles-all"],
    queryFn: async () => (await supabase.from("roles").select("*").order("name")).data ?? [],
  });
  const teams = useQuery({
    queryKey: ["teams-all"],
    queryFn: async () => (await supabase.from("teams").select("*").order("name")).data ?? [],
  });
  const regimes = useQuery({
    queryKey: ["regimes"],
    queryFn: async () => (await supabase.from("work_regimes").select("*").order("name")).data ?? [],
  });

  const addRole = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      const { error } = await supabase
        .from("roles")
        .insert({ company_id: company.id, name: roleName.trim(), unit_id: activeUnitId });
      if (error) throw error;
    },
    onSuccess: () => {
      setRoleName("");
      toast.success("Cargo criado.");
      queryClient.invalidateQueries({ queryKey: ["roles-all"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: () => toast.error("Erro ao criar cargo."),
  });

  const addTeam = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      const { error } = await supabase
        .from("teams")
        .insert({ company_id: company.id, name: teamName.trim(), unit_id: activeUnitId });
      if (error) throw error;
    },
    onSuccess: () => {
      setTeamName("");
      toast.success("Equipe criada.");
      queryClient.invalidateQueries({ queryKey: ["teams-all"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: () => toast.error("Erro ao criar equipe."),
  });

  const addRegime = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      const { error } = await supabase.from("work_regimes").insert({
        company_id: company.id,
        name: regimeName.trim(),
        regime_type: regimeType,
        weekly_hours_limit: Number(weeklyHours) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRegimeName("");
      toast.success("Regime criado.");
      queryClient.invalidateQueries({ queryKey: ["regimes"] });
    },
    onError: () => toast.error("Erro ao criar regime."),
  });

  return (
    <>
      <PageHeader
        title="Cargos e equipes"
        description="Defina a estrutura da operação e os regimes de jornada usados nas escalas."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Cargos">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addRole.mutate();
            }}
          >
            <Input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="Ex.: Cozinheiro"
              maxLength={80}
              required
              aria-label="Nome do cargo"
            />
            <Button type="submit">Add</Button>
          </form>
          <ul className="mt-4 space-y-1 text-sm">
            {(roles.data ?? []).map((r) => (
              <li key={r.id} className="rounded-md bg-secondary px-3 py-2">
                {r.name}
              </li>
            ))}
            {roles.data?.length === 0 ? <EmptyState title="Nenhum cargo" /> : null}
          </ul>
        </SectionCard>

        <SectionCard title="Equipes">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addTeam.mutate();
            }}
          >
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Ex.: Salão manhã"
              maxLength={80}
              required
              aria-label="Nome da equipe"
            />
            <Button type="submit">Add</Button>
          </form>
          <ul className="mt-4 space-y-1 text-sm">
            {(teams.data ?? []).map((t) => (
              <li key={t.id} className="rounded-md bg-secondary px-3 py-2">
                {t.name}
              </li>
            ))}
            {teams.data?.length === 0 ? <EmptyState title="Nenhuma equipe" /> : null}
          </ul>
        </SectionCard>

        <SectionCard title="Regimes de trabalho">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              addRegime.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="regimeName">Nome</Label>
              <Input
                id="regimeName"
                value={regimeName}
                onChange={(e) => setRegimeName(e.target.value)}
                placeholder="Ex.: Cozinha 6x1"
                maxLength={80}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="regimeType">Padrão</Label>
                <Select value={regimeType} onValueChange={(v) => setRegimeType(v as Enums<"regime_type">)}>
                  <SelectTrigger id="regimeType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weekly">Horas/semana</Label>
                <Input
                  id="weekly"
                  type="number"
                  min={1}
                  max={80}
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Criar regime
            </Button>
          </form>
          <ul className="mt-4 space-y-1 text-sm">
            {(regimes.data ?? []).map((r) => (
              <li key={r.id} className="rounded-md bg-secondary px-3 py-2">
                {r.name} · {r.regime_type} · {r.weekly_hours_limit ?? "—"}h
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}

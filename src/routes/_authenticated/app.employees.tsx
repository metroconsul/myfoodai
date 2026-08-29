import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setEmployeePin } from "@/lib/admin.functions";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { maskCpf, maskCpfPrivate, onlyDigits } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const STATUSES: Enums<"employment_status">[] = ["ativo", "afastado", "ferias", "desligado"];

export const Route = createFileRoute("/_authenticated/app/employees")({
  head: () => ({
    meta: [
      { title: `Colaboradores — ${BRAND_NAME}` },
      { name: "description", content: "Cadastro de colaboradores, cargos, equipes e acesso ao portal por PIN." },
      { property: "og:title", content: `Colaboradores — ${BRAND_NAME}` },
      { property: "og:description", content: "Equipe, vínculos e acesso ao portal." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { company, activeUnitId, units } = useWorkspace();
  const queryClient = useQueryClient();
  const setPin = useServerFn(setEmployeePin);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<{ id: string; name: string } | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    email: "",
    whatsapp_phone: "",
    role_id: "",
    team_id: "",
    unit_id: "",
  });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, roles(name), teams(name), units(name)")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("id, name").eq("active", true).order("name")).data ?? [],
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("id, name").eq("active", true).order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.full_name.toLowerCase().includes(q) || onlyDigits(e.cpf).includes(onlyDigits(q)),
    );
  }, [employees, search]);

  const createEmployee = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      const cpf = onlyDigits(form.cpf);
      if (cpf.length !== 11) throw new Error("Informe um CPF com 11 dígitos.");
      const { error } = await supabase.from("employees").insert({
        company_id: company.id,
        unit_id: form.unit_id || activeUnitId,
        full_name: form.full_name.trim(),
        cpf,
        email: form.email.trim() || null,
        whatsapp_phone: form.whatsapp_phone.trim() || null,
        role_id: form.role_id || null,
        team_id: form.team_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador cadastrado.");
      setOpen(false);
      setForm({ full_name: "", cpf: "", email: "", whatsapp_phone: "", role_id: "", team_id: "", unit_id: "" });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao cadastrar."),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Enums<"employment_status"> }) => {
      const { error } = await supabase.from("employees").update({ employment_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const savePin = useMutation({
    mutationFn: async () => {
      if (!pinTarget) return;
      await setPin({ data: { employeeId: pinTarget.id, pin: pinValue } });
    },
    onSuccess: () => {
      toast.success("PIN definido. Compartilhe com o colaborador com segurança.");
      setPinTarget(null);
      setPinValue("");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao definir PIN."),
  });

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Cadastro, vínculos e acesso ao Portal do Colaborador por CPF e PIN."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Novo colaborador</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo colaborador</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createEmployee.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={maskCpf(form.cpf)}
                      onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                      inputMode="numeric"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unit">Unidade</Label>
                    <Select
                      value={form.unit_id || activeUnitId || ""}
                      onValueChange={(v) => setForm({ ...form, unit_id: v })}
                    >
                      <SelectTrigger id="unit">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      maxLength={255}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="whats">WhatsApp</Label>
                    <Input
                      id="whats"
                      value={form.whatsapp_phone}
                      onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })}
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role">Cargo</Label>
                    <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="team">Equipe</Label>
                    <Select value={form.team_id} onValueChange={(v) => setForm({ ...form, team_id: v })}>
                      <SelectTrigger id="team">
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createEmployee.isPending}>
                  Salvar colaborador
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por nome ou CPF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar colaborador"
        />
      </div>

      <SectionCard>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum colaborador encontrado" description="Cadastre a equipe para liberar escalas e ponto." />
        ) : (
          <ul className="divide-y-2 divide-foreground">
            {filtered.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{e.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {maskCpfPrivate(e.cpf)} · {(e.roles as { name: string } | null)?.name ?? "sem cargo"} ·{" "}
                    {(e.units as { name: string } | null)?.name ?? "sem unidade"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={e.portal_pin_hash ? "ok" : "warn"}>
                    {e.portal_pin_hash ? "Portal ativo" : "Sem PIN"}
                  </StatusBadge>
                  <Select
                    value={e.employment_status}
                    onValueChange={(v) =>
                      changeStatus.mutate({ id: e.id, status: v as Enums<"employment_status"> })
                    }
                  >
                    <SelectTrigger className="w-[140px]" aria-label="Situação">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setPinTarget({ id: e.id, name: e.full_name })}>
                    Definir PIN
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={!!pinTarget} onOpenChange={(o) => !o && setPinTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN do portal — {pinTarget?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              savePin.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pin">Novo PIN (4 a 8 dígitos)</Label>
              <Input
                id="pin"
                value={pinValue}
                onChange={(ev) => setPinValue(onlyDigits(ev.target.value).slice(0, 8))}
                inputMode="numeric"
                required
              />
              <p className="text-xs text-muted-foreground">
                O PIN é armazenado com hash. Compartilhe por canal seguro.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={savePin.isPending}>
              Salvar PIN
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

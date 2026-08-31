import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { FileUp, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { BRAND_NAME } from "@/config/brand";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dateFmt } from "@/lib/format";
import { createPayslip, importPayslipBatch, publishPayslips } from "@/lib/payslips.functions";
import {
  ACCEPTANCE_POLICIES,
  PAYSLIP_STATUSES,
  PAYSLIP_STATUS_LABEL,
  PAYSLIP_STATUS_TONE,
  POLICY_HINT,
  POLICY_LABEL,
  competenceLabel,
  competenceToDate,
  currentCompetence,
} from "@/lib/payslips.shared";

export const Route = createFileRoute("/_authenticated/app/documentos/holerites/")({
  head: () => ({
    meta: [
      { title: `Holerites — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Publique, acompanhe e audite a entrega e a assinatura de holerites da equipe.",
      },
      { property: "og:title", content: `Holerites — ${BRAND_NAME}` },
      { property: "og:description", content: "Entrega, aceite e auditoria de holerites." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayslipsPage,
});

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function PayslipsPage() {
  const { units } = useWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodFilter, setPeriodFilter] = useState("todas");
  const [newOpen, setNewOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const createFn = useServerFn(createPayslip);
  const publishFn = useServerFn(publishPayslips);
  const batchFn = useServerFn(importPayslipBatch);

  const employeesQuery = useQuery({
    queryKey: ["payslip-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, unit_id, employee_code, employment_status")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const payslipsQuery = useQuery({
    queryKey: ["payslips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select("*")
        .is("archived_at", null)
        .order("payroll_period", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const disputesQuery = useQuery({
    queryKey: ["payslip-disputes-open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslip_disputes")
        .select("id, payslip_id, status")
        .in("status", ["aberta", "em_analise", "aguardando_colaborador"]);
      if (error) throw error;
      return data;
    },
  });

  const employeeMap = useMemo(
    () => new Map((employeesQuery.data ?? []).map((e) => [e.id, e])),
    [employeesQuery.data],
  );
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  const rows = payslipsQuery.data ?? [];

  const periods = useMemo(
    () => Array.from(new Set(rows.map((r) => r.payroll_period))).sort().reverse(),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (unitFilter !== "todas" && r.unit_id !== unitFilter) return false;
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (periodFilter !== "todas" && r.payroll_period !== periodFilter) return false;
      if (term) {
        const name = employeeMap.get(r.employee_id)?.full_name?.toLowerCase() ?? "";
        if (!name.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, unitFilter, statusFilter, periodFilter, employeeMap]);

  const drafts = filtered.filter((r) => r.status === "draft" || r.status === "corrected");
  const signedCount = filtered.filter((r) => r.status === "signed").length;
  const pendingCount = filtered.filter((r) =>
    ["published", "viewed", "awaiting_signature", "corrected"].includes(r.status),
  ).length;

  const publish = useMutation({
    mutationFn: async (ids: string[]) => publishFn({ data: { ids } }),
    onSuccess: (res) => {
      toast.success(`${res.published} holerite(s) publicado(s).`);
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Formulário de holerite individual
  const [form, setForm] = useState({
    employeeId: "",
    competence: currentCompetence().slice(0, 7).split("-").reverse().join("/"),
    referenceLabel: "",
    policy: "assinatura" as (typeof ACCEPTANCE_POLICIES)[number],
    dueAt: "",
    publishNow: true,
  });
  const [file, setFile] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione o arquivo do holerite.");
      const period = competenceToDate(form.competence);
      if (!period) throw new Error("Informe a competência no formato mm/aaaa.");
      return createFn({
        data: {
          employeeId: form.employeeId,
          payrollPeriod: period,
          referenceLabel: form.referenceLabel.trim() || null,
          acceptancePolicy: form.policy,
          dueAt: form.dueAt || null,
          publishNow: form.publishNow,
          fileName: file.name,
          fileDataUrl: await fileToDataUrl(file),
        },
      });
    },
    onSuccess: () => {
      toast.success("Holerite criado.");
      setNewOpen(false);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Importação em lote
  const [batch, setBatch] = useState({
    competence: currentCompetence().slice(0, 7).split("-").reverse().join("/"),
    policy: "assinatura" as (typeof ACCEPTANCE_POLICIES)[number],
    dueAt: "",
    publishNow: false,
  });
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchResult, setBatchResult] = useState<
    Array<{ file: string; employee: string | null; ok: boolean; message?: string }>
  >([]);

  const runBatch = useMutation({
    mutationFn: async () => {
      const period = competenceToDate(batch.competence);
      if (!period) throw new Error("Informe a competência no formato mm/aaaa.");
      if (!batchFiles.length) throw new Error("Selecione os arquivos do lote.");
      const files = await Promise.all(
        batchFiles.map(async (f) => ({
          fileName: f.name,
          fileDataUrl: await fileToDataUrl(f),
          matchKey: f.name.replace(/\.[^.]+$/, "").split(/[_\-\s]/)[0] ?? f.name,
        })),
      );
      return batchFn({
        data: {
          payrollPeriod: period,
          acceptancePolicy: batch.policy,
          dueAt: batch.dueAt || null,
          publishNow: batch.publishNow,
          files,
        },
      });
    },
    onSuccess: (res) => {
      setBatchResult(res.results);
      const ok = res.results.filter((r) => r.ok).length;
      toast.success(`${ok} de ${res.results.length} arquivos importados.`);
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (payslipsQuery.isLoading) return <LoadingState rows={6} label="Carregando holerites…" />;
  if (payslipsQuery.isError)
    return (
      <ErrorState
        action={
          <Button variant="outline" onClick={() => payslipsQuery.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );

  const openDisputes = new Set((disputesQuery.data ?? []).map((d) => d.payslip_id));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentos do colaborador"
        title="Holerites"
        description="Publique documentos, acompanhe a conferência da equipe e mantenha a trilha de auditoria completa."
        actions={
          <>
            <Button variant="outline" onClick={() => setBatchOpen(true)}>
              <FileUp className="mr-2 size-4" />
              Importar em lote
            </Button>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 size-4" />
              Novo holerite
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={filtered.length} hint="Documentos no filtro atual" />
        <StatCard label="Aguardando aceite" value={pendingCount} tone="warning" />
        <StatCard label="Assinados" value={signedCount} tone="success" />
        <StatCard label="Divergências abertas" value={openDisputes.size} tone="danger" />
      </div>

      <SectionCard
        title="Filtros"
        action={
          drafts.length ? (
            <Button
              size="sm"
              disabled={publish.isPending}
              onClick={() => publish.mutate(drafts.map((d) => d.id))}
            >
              <Send className="mr-2 size-4" />
              Publicar {drafts.length} rascunho(s)
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              aria-label="Buscar colaborador"
              className="pl-9"
              placeholder="Buscar colaborador"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger aria-label="Unidade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {PAYSLIP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PAYSLIP_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger aria-label="Competência">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as competências</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p} value={p}>
                  {competenceLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum holerite encontrado"
          description="Ajuste os filtros ou publique um novo documento."
        />
      ) : (
        <SectionCard title="Documentos">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b-2 border-foreground text-left">
                  <th className="py-2 pr-3">Colaborador</th>
                  <th className="py-2 pr-3">Competência</th>
                  <th className="py-2 pr-3">Unidade</th>
                  <th className="py-2 pr-3">Política</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Prazo</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-foreground/20">
                    <td className="py-2 pr-3 font-medium">
                      {employeeMap.get(r.employee_id)?.full_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{competenceLabel(r.payroll_period)}</td>
                    <td className="py-2 pr-3">{r.unit_id ? (unitMap.get(r.unit_id) ?? "—") : "—"}</td>
                    <td className="py-2 pr-3 text-xs">{POLICY_LABEL[r.acceptance_policy]}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge tone={PAYSLIP_STATUS_TONE[r.status] ?? "neutral"}>
                        {PAYSLIP_STATUS_LABEL[r.status] ?? r.status}
                      </StatusBadge>
                    </td>
                    <td className="py-2 pr-3">{r.due_at ? dateFmt(r.due_at) : "—"}</td>
                    <td className="py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/documentos/holerites/$id" params={{ id: r.id }}>
                          Abrir
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo holerite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ps-employee">Colaborador</Label>
              <Select
                value={form.employeeId}
                onValueChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}
              >
                <SelectTrigger id="ps-employee">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(employeesQuery.data ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ps-competence">Competência (mm/aaaa)</Label>
                <Input
                  id="ps-competence"
                  inputMode="numeric"
                  placeholder="08/2026"
                  value={form.competence}
                  onChange={(e) => setForm((f) => ({ ...f, competence: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-due">Prazo de conferência</Label>
                <Input
                  id="ps-due"
                  type="date"
                  value={form.dueAt}
                  onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-label">Identificação (opcional)</Label>
              <Input
                id="ps-label"
                placeholder="Holerite mensal, 13º salário, férias…"
                value={form.referenceLabel}
                onChange={(e) => setForm((f) => ({ ...f, referenceLabel: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-policy">Política de aceite</Label>
              <Select
                value={form.policy}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, policy: v as (typeof ACCEPTANCE_POLICIES)[number] }))
                }
              >
                <SelectTrigger id="ps-policy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCEPTANCE_POLICIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {POLICY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{POLICY_HINT[form.policy]}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-file">Arquivo (PDF, PNG ou JPG)</Label>
              <Input
                id="ps-file"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 rounded-[6px] border-2 border-foreground accent-[var(--acid)]"
                checked={form.publishNow}
                onChange={(e) => setForm((f) => ({ ...f, publishNow: e.target.checked }))}
              />
              Publicar imediatamente no portal
            </label>
            <Button
              className="w-full"
              disabled={!form.employeeId || !file || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Enviando…" : "Salvar holerite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar holerites em lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="rounded-[10px] border-2 border-foreground bg-secondary p-3 text-xs">
              Nomeie cada arquivo começando pela matrícula ou pelo CPF do colaborador — por exemplo
              <strong> 1042_agosto.pdf</strong> ou <strong>00000000191.pdf</strong>. O sistema faz a
              conciliação automaticamente e mostra o que não foi reconhecido.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pb-competence">Competência (mm/aaaa)</Label>
                <Input
                  id="pb-competence"
                  value={batch.competence}
                  onChange={(e) => setBatch((b) => ({ ...b, competence: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pb-due">Prazo de conferência</Label>
                <Input
                  id="pb-due"
                  type="date"
                  value={batch.dueAt}
                  onChange={(e) => setBatch((b) => ({ ...b, dueAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pb-policy">Política de aceite</Label>
              <Select
                value={batch.policy}
                onValueChange={(v) =>
                  setBatch((b) => ({ ...b, policy: v as (typeof ACCEPTANCE_POLICIES)[number] }))
                }
              >
                <SelectTrigger id="pb-policy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCEPTANCE_POLICIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {POLICY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pb-files">Arquivos (até 40)</Label>
              <Input
                id="pb-files"
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => setBatchFiles(Array.from(e.target.files ?? []))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 rounded-[6px] border-2 border-foreground accent-[var(--acid)]"
                checked={batch.publishNow}
                onChange={(e) => setBatch((b) => ({ ...b, publishNow: e.target.checked }))}
              />
              Publicar automaticamente após a validação
            </label>
            <Button
              className="w-full"
              disabled={!batchFiles.length || runBatch.isPending}
              onClick={() => runBatch.mutate()}
            >
              {runBatch.isPending ? "Importando…" : `Importar ${batchFiles.length} arquivo(s)`}
            </Button>

            {batchResult.length ? (
              <div className="space-y-2">
                <p className="text-sm font-bold uppercase tracking-widest">Resultado</p>
                <ul className="space-y-1 text-xs">
                  {batchResult.map((r) => (
                    <li
                      key={r.file}
                      className="flex items-start justify-between gap-2 rounded-[8px] border-2 border-foreground bg-card px-3 py-2"
                    >
                      <span className="min-w-0 truncate">
                        {r.file} — {r.employee ?? "não conciliado"}
                      </span>
                      <StatusBadge tone={r.ok ? "ok" : "danger"}>
                        {r.ok ? "OK" : (r.message ?? "Erro")}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { BRAND_NAME } from "@/config/brand";
import {
  PageHeader,
  SectionCard,
  EmptyState,
  LoadingState,
  ErrorState,
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
import {
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_STATUS_TONE,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  REQUEST_MODES,
  REQUEST_MODE_LABEL,
  effectiveDocumentStatus,
} from "@/lib/compliance.shared";

export const Route = createFileRoute("/_authenticated/app/conformidade/exames/")({
  head: () => ({
    meta: [
      { title: `Exames e aptidão — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Controle documentos ocupacionais, prazos e pendências da equipe.",
      },
      { property: "og:title", content: `Exames e aptidão — ${BRAND_NAME}` },
      { property: "og:description", content: "Documentos ocupacionais, prazos e pendências." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamsPage,
});

function ExamsPage() {
  const { units } = useWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("todas");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [windowDays, setWindowDays] = useState("todos");
  const [fileFilter, setFileFilter] = useState("todos");
  const [requestOpen, setRequestOpen] = useState(false);

  const employeesQuery = useQuery({
    queryKey: ["compliance-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, unit_id, role_id, employment_status")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const docsQuery = useQuery({
    queryKey: ["occupational-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occupational_documents")
        .select("*")
        .is("archived_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const employeeMap = useMemo(
    () => new Map((employeesQuery.data ?? []).map((e) => [e.id, e])),
    [employeesQuery.data],
  );
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (docsQuery.data ?? [])
      .map((doc) => ({ ...doc, effective: effectiveDocumentStatus(doc.status, doc.expires_at) }))
      .filter((doc) => {
        if (unitFilter !== "todas" && doc.unit_id !== unitFilter) return false;
        if (typeFilter !== "todos" && doc.document_type !== typeFilter) return false;
        if (statusFilter !== "todos" && doc.effective !== statusFilter) return false;
        if (fileFilter === "com" && !doc.file_path) return false;
        if (fileFilter === "sem" && doc.file_path) return false;
        if (windowDays !== "todos") {
          if (!doc.expires_at) return false;
          const days = Math.round(
            (new Date(`${doc.expires_at}T00:00:00`).getTime() - Date.now()) / 86_400_000,
          );
          if (days > Number(windowDays)) return false;
        }
        if (term) {
          const name = employeeMap.get(doc.employee_id)?.full_name?.toLowerCase() ?? "";
          if (!name.includes(term) && !doc.title.toLowerCase().includes(term)) return false;
        }
        return true;
      });
  }, [
    docsQuery.data,
    search,
    unitFilter,
    typeFilter,
    statusFilter,
    fileFilter,
    windowDays,
    employeeMap,
  ]);

  if (docsQuery.isLoading) return <LoadingState rows={6} label="Carregando documentos…" />;
  if (docsQuery.isError)
    return (
      <ErrorState
        action={
          <Button variant="outline" onClick={() => docsQuery.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conformidade e equipe"
        title="Exames e aptidão"
        description="Controle documentos, prazos e pendências da equipe."
        actions={
          <>
            <Button variant="outline" onClick={() => setRequestOpen(true)}>
              <Send className="mr-2 size-4" /> Solicitar documento
            </Button>
            <Link to="/app/conformidade/exames/novo">
              <Button>
                <FileText className="mr-2 size-4" /> Adicionar documento
              </Button>
            </Link>
          </>
        }
      />

      <SectionCard title="Filtros">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Buscar colaborador ou documento"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar"
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
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger aria-label="Tipo de documento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOCUMENT_TYPE_LABEL[t]}
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
              {DOCUMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {DOCUMENT_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={windowDays} onValueChange={setWindowDays}>
            <SelectTrigger aria-label="Vencimento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer prazo</SelectItem>
              {[7, 30, 60, 90].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Vence em até {d} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fileFilter} onValueChange={setFileFilter}>
            <SelectTrigger aria-label="Arquivo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Com ou sem arquivo</SelectItem>
              <SelectItem value="com">Com arquivo</SelectItem>
              <SelectItem value="sem">Sem arquivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhum documento encontrado"
          description="Ajuste os filtros ou cadastre um novo documento ocupacional."
        />
      ) : (
        <SectionCard title={`${rows.length} documento(s)`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left">
                  {[
                    "Colaborador",
                    "Unidade",
                    "Tipo",
                    "Realização",
                    "Validade",
                    "Status",
                    "Arquivo",
                    "Atualizado",
                    "",
                  ].map((h) => (
                    <th key={h} className="meta-mono pb-2 pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-foreground/10">
                {rows.map((doc) => (
                  <tr key={doc.id}>
                    <td className="py-3 pr-3 font-semibold">
                      {employeeMap.get(doc.employee_id)?.full_name ?? "—"}
                    </td>
                    <td className="py-3 pr-3">
                      {doc.unit_id ? (unitMap.get(doc.unit_id) ?? "—") : "—"}
                    </td>
                    <td className="py-3 pr-3">{DOCUMENT_TYPE_LABEL[doc.document_type]}</td>
                    <td className="py-3 pr-3">{dateFmt(doc.performed_at)}</td>
                    <td className="py-3 pr-3">{dateFmt(doc.expires_at ?? doc.next_review_at)}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge tone={DOCUMENT_STATUS_TONE[doc.effective] ?? "neutral"}>
                        {DOCUMENT_STATUS_LABEL[doc.effective] ?? doc.effective}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pr-3">{doc.file_path ? "Sim" : "Não"}</td>
                    <td className="py-3 pr-3">{dateFmt(doc.updated_at)}</td>
                    <td className="py-3">
                      <Link to="/app/conformidade/exames/$id" params={{ id: doc.id }}>
                        <Button variant="outline" size="sm">
                          Abrir
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <p className="text-xs text-muted-foreground">
        Gestores comuns visualizam apenas o status administrativo. O sistema não interpreta
        resultados nem calcula aptidão médica.
      </p>

      <RequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        employees={employeesQuery.data ?? []}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["occupational-documents"] })}
      />
    </div>
  );
}

function RequestDialog({
  open,
  onOpenChange,
  employees,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: { id: string; full_name: string; unit_id: string | null }[];
  onDone: () => void;
}) {
  const { company, units } = useWorkspace();
  const [unitId, setUnitId] = useState("todas");
  const [documentType, setDocumentType] = useState<string>("aso_periodico");
  const [mode, setMode] = useState<string>("enviar_documento");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const visible = employees.filter((e) => unitId === "todas" || e.unit_id === unitId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error("Empresa não encontrada.");
      if (selected.length === 0) throw new Error("Selecione ao menos um colaborador.");
      const batchId = crypto.randomUUID();
      const rows = selected.map((employeeId) => ({
        company_id: company.id,
        unit_id: employees.find((e) => e.id === employeeId)?.unit_id ?? null,
        employee_id: employeeId,
        document_type: documentType as never,
        request_mode: mode as never,
        due_at: dueAt || null,
        message: message || null,
        requires_upload: mode === "enviar_documento",
        requires_acknowledgement: mode === "confirmar_ciencia",
        requires_signature: mode === "assinar",
        batch_id: batchId,
      }));
      const { error } = await supabase.from("document_requests").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} solicitação(ões) publicada(s) no portal.`);
      setSelected([]);
      onOpenChange(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Solicitar documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Unidade</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
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
            </div>
            <div>
              <Label>Tipo de documento</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOCUMENT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>O colaborador deve</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {REQUEST_MODE_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="due">Prazo para envio</Label>
              <Input
                id="due"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="msg">Mensagem administrativa</Label>
            <Textarea
              id="msg"
              value={message}
              maxLength={600}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div>
            <Label>Colaboradores ({selected.length} selecionado(s))</Label>
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-[10px] border-2 border-foreground p-2">
              {visible.map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1 text-sm hover:bg-secondary"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(e.id)}
                    onChange={(ev) =>
                      setSelected((prev) =>
                        ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id),
                      )
                    }
                  />
                  {e.full_name}
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            As solicitações aparecem no Portal do Colaborador. Nesta versão nenhum envio automático
            por WhatsApp é realizado.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Publicar solicitações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

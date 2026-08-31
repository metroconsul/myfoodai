import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { BRAND_NAME } from "@/config/brand";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrDateInput } from "@/components/ui/br-inputs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_LABEL,
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  REQUEST_MODES,
  REQUEST_MODE_LABEL,
  isHealthDocument,
} from "@/lib/compliance.shared";

export const Route = createFileRoute("/_authenticated/app/conformidade/exames/novo")({
  head: () => ({
    meta: [
      { title: `Novo documento ocupacional — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Cadastre ASO, exames e documentos ocupacionais com prazos e arquivo.",
      },
      { property: "og:title", content: `Novo documento ocupacional — ${BRAND_NAME}` },
      { property: "og:description", content: "Cadastro de documentos ocupacionais." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewDocumentPage,
});

const MAX_FILE_BYTES = 8_000_000;

function NewDocumentPage() {
  const { company, units, activeUnitId } = useWorkspace();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    employeeId: "",
    unitId: activeUnitId ?? "",
    documentType: "aso_admissional",
    title: "",
    performedAt: "",
    expiresAt: "",
    nextReviewAt: "",
    providerName: "",
    providerReference: "",
    notes: "",
    reportedStatus: "",
    accessLevel: "rh_autorizado",
    requestMode: "visualizar",
    status: "em_revisao",
    nextAction: "",
    nextActionDueAt: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const employees = useQuery({
    queryKey: ["compliance-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, unit_id")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const health = isHealthDocument(form.documentType);

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!company?.id) throw new Error("Empresa não encontrada.");
      if (!form.employeeId) throw new Error("Selecione o colaborador.");
      if (!form.title.trim()) throw new Error("Informe o título do documento.");
      if (file && file.size > MAX_FILE_BYTES) throw new Error("Arquivo maior que 8 MB.");

      let filePath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
        filePath = `${company.id}/documentos/${form.employeeId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("documents")
          .upload(filePath, file, { upsert: false });
        if (error) throw new Error("Não foi possível enviar o arquivo.");
      }

      const { data, error } = await supabase
        .from("occupational_documents")
        .insert({
          company_id: company.id,
          unit_id: form.unitId || null,
          employee_id: form.employeeId,
          document_type: form.documentType as never,
          title: form.title.trim(),
          status: form.status as never,
          performed_at: form.performedAt || null,
          expires_at: form.expiresAt || null,
          next_review_at: form.nextReviewAt || null,
          provider_name: form.providerName || null,
          provider_reference: form.providerReference || null,
          administrative_notes: form.notes || null,
          reported_status: form.reportedStatus || null,
          clinical_access_level: (health ? form.accessLevel : "administrativo") as never,
          file_path: filePath,
          file_name: file?.name ?? null,
          file_size: file?.size ?? null,
          request_mode: form.requestMode as never,
          next_action: form.nextAction || null,
          next_action_due_at: form.nextActionDueAt || null,
          is_draft: !publish,
          published_to_portal_at: publish ? new Date().toISOString() : null,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id;
    },
    onSuccess: (id) => {
      toast.success("Documento salvo.");
      if (id) navigate({ to: "/app/conformidade/exames/$id", params: { id } });
      else navigate({ to: "/app/conformidade/exames" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exames e aptidão"
        title="Novo exame ou documento"
        description="Cadastre ASO, exames e documentos ocupacionais com prazos, responsável e arquivo."
      />

      <SectionCard title="Identificação">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Colaborador</Label>
            <Select value={form.employeeId} onValueChange={set("employeeId")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
          <div>
            <Label>Unidade</Label>
            <Select value={form.unitId} onValueChange={set("unitId")}>
              <SelectTrigger>
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
          <div>
            <Label>Tipo de documento</Label>
            <Select value={form.documentType} onValueChange={set("documentType")}>
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
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={form.title}
              maxLength={160}
              onChange={(e) => set("title")(e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Datas e responsável">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <Label htmlFor="performed">Data de realização</Label>
            <BrDateInput
              id="performed"
              value={form.performedAt}
              onChange={(v) => set("performedAt")(v)}
            />
...
            <BrDateInput
              id="expires"
              value={form.expiresAt}
              onChange={(v) => set("expiresAt")(v)}
            />
...
            <BrDateInput
              id="review"
              value={form.nextReviewAt}
              onChange={(v) => set("nextReviewAt")(v)}
            />
          </div>
          <div>
            <Label htmlFor="provider">Clínica, laboratório ou responsável</Label>
            <Input
              id="provider"
              value={form.providerName}
              maxLength={160}
              onChange={(e) => set("providerName")(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ref">Número ou referência</Label>
            <Input
              id="ref"
              value={form.providerReference}
              maxLength={120}
              onChange={(e) => set("providerReference")(e.target.value)}
            />
          </div>
          <div>
            <Label>Status administrativo</Label>
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {DOCUMENT_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Arquivo e privacidade">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="file">Arquivo (PDF ou imagem, até 8 MB)</Label>
            <Input
              id="file"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="meta-mono mt-1">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            ) : null}
          </div>
          <div>
            <Label>Classificação de acesso</Label>
            <Select value={form.accessLevel} onValueChange={set("accessLevel")} disabled={!health}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_LEVELS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACCESS_LEVEL_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {health ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Documento de saúde: o conteúdo não aparece em listas, dashboards ou exportações
                gerais.
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="reported">Status informado no documento (opcional, restrito)</Label>
            <Input
              id="reported"
              value={form.reportedStatus}
              maxLength={120}
              onChange={(e) => set("reportedStatus")(e.target.value)}
              placeholder="Somente o que consta no documento emitido"
            />
          </div>
          <div>
            <Label>Ação exigida no portal</Label>
            <Select value={form.requestMode} onValueChange={set("requestMode")}>
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
        </div>
      </SectionCard>

      <SectionCard title="Próxima ação e observações">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="action">Próxima ação</Label>
            <Input
              id="action"
              value={form.nextAction}
              maxLength={160}
              onChange={(e) => set("nextAction")(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="actionDue">Data limite da ação</Label>
            <BrDateInput
              id="actionDue"
              value={form.nextActionDueAt}
              onChange={(v) => set("nextActionDueAt")(v)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Observação administrativa</Label>
            <Textarea
              id="notes"
              value={form.notes}
              maxLength={1000}
              onChange={(e) => set("notes")(e.target.value)}
              placeholder="Evite registrar dados clínicos desnecessários."
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/app/conformidade/exames" })}>
          Cancelar
        </Button>
        <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate(false)}>
          Salvar como rascunho
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate(true)}>
          Publicar para o colaborador
        </Button>
      </div>
    </div>
  );
}

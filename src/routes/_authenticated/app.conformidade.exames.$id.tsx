import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { BRAND_NAME } from "@/config/brand";
import { PageHeader, SectionCard, StatusBadge, LoadingState, ErrorState, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateFmt, dateTimeFmt } from "@/lib/format";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_STATUS_TONE,
  DOCUMENT_TYPE_LABEL,
  effectiveDocumentStatus,
  isHealthDocument,
} from "@/lib/compliance.shared";

export const Route = createFileRoute("/_authenticated/app/conformidade/exames/$id")({
  head: () => ({
    meta: [
      { title: `Documento ocupacional — ${BRAND_NAME}` },
      { name: "description", content: "Detalhes, prazos, arquivo e trilha de auditoria do documento." },
      { property: "og:title", content: `Documento ocupacional — ${BRAND_NAME}` },
      { property: "og:description", content: "Detalhes do documento ocupacional." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DocumentDetailPage,
});

function DocumentDetailPage() {
  const { id } = Route.useParams();
  const { isAdmin, roles } = useWorkspace();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const canSeeFile = isAdmin || roles.includes("hr");

  const query = useQuery({
    queryKey: ["occupational-document", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occupational_documents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Documento não encontrado.");
      const [{ data: employee }, { data: logs }, { data: ack }] = await Promise.all([
        supabase.from("employees").select("full_name, employee_code").eq("id", data.employee_id).maybeSingle(),
        supabase
          .from("document_access_logs")
          .select("id, actor_type, event_type, created_at")
          .eq("document_id", id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("document_acknowledgements")
          .select("*")
          .eq("document_id", id)
          .order("document_version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { document: data, employee, logs: logs ?? [], acknowledgement: ack };
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("occupational_documents").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento atualizado.");
      queryClient.invalidateQueries({ queryKey: ["occupational-document", id] });
      queryClient.invalidateQueries({ queryKey: ["occupational-documents"] });
    },
    onError: () => toast.error("Não foi possível atualizar agora."),
  });

  const download = useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw new Error("Arquivo indisponível.");
      const doc = query.data?.document;
      if (doc) {
        await supabase.from("document_access_logs").insert({
          company_id: doc.company_id,
          document_id: doc.id,
          actor_type: "gestor",
          event_type: "download",
          metadata: {},
        });
      }
      window.open(data.signedUrl, "_blank", "noopener");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState rows={5} label="Carregando documento…" />;
  if (query.isError || !query.data)
    return <ErrorState title="Documento não encontrado" description="Verifique o link ou volte para a lista." />;

  const doc = query.data.document;
  const effective = effectiveDocumentStatus(doc.status, doc.expires_at);
  const health = isHealthDocument(doc.document_type);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exames e aptidão"
        title={doc.title}
        description={`${DOCUMENT_TYPE_LABEL[doc.document_type]} · ${query.data.employee?.full_name ?? "Colaborador"}`}
        actions={
          <Link to="/app/conformidade/exames">
            <Button variant="outline">
              <ArrowLeft className="mr-2 size-4" /> Voltar
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={DOCUMENT_STATUS_TONE[effective] ?? "neutral"}>
          {DOCUMENT_STATUS_LABEL[effective] ?? effective}
        </StatusBadge>
        {doc.published_to_portal_at ? (
          <StatusBadge tone="info">Publicado no portal</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Rascunho</StatusBadge>
        )}
        <StatusBadge tone="neutral">Versão {doc.version}</StatusBadge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Dados do documento">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="meta-mono">Realização</dt><dd>{dateFmt(doc.performed_at)}</dd></div>
            <div><dt className="meta-mono">Validade</dt><dd>{dateFmt(doc.expires_at)}</dd></div>
            <div><dt className="meta-mono">Próxima revisão</dt><dd>{dateFmt(doc.next_review_at)}</dd></div>
            <div><dt className="meta-mono">Responsável</dt><dd>{doc.provider_name ?? "—"}</dd></div>
            <div><dt className="meta-mono">Referência</dt><dd>{doc.provider_reference ?? "—"}</dd></div>
            <div><dt className="meta-mono">Próxima ação</dt><dd>{doc.next_action ?? "—"}</dd></div>
          </dl>
          {health ? (
            <p className="mt-4 flex items-start gap-2 rounded-[10px] border-2 border-foreground bg-warning p-3 text-xs">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Documento de saúde com acesso restrito. O sistema não interpreta resultados nem determina aptidão.
            </p>
          ) : null}
        </SectionCard>

        <SectionCard title="Arquivo">
          {doc.file_path ? (
            canSeeFile ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{doc.file_name ?? "Arquivo anexado"}</p>
                <p className="meta-mono">
                  {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"} · enviado em {dateFmt(doc.created_at)}
                </p>
                <Button onClick={() => download.mutate(doc.file_path!)} disabled={download.isPending}>
                  <Download className="mr-2 size-4" /> Baixar documento
                </Button>
                <p className="text-xs text-muted-foreground">O download é registrado na trilha de auditoria.</p>
              </div>
            ) : (
              <EmptyState
                title="Acesso restrito"
                description="Você visualiza apenas o status administrativo deste documento."
              />
            )
          ) : (
            <EmptyState title="Sem arquivo" description="Nenhum arquivo foi anexado a este documento." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Atualizar metadados">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Status</Label>
            <Select value={status ?? doc.status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_STATUSES.map((s) => (<SelectItem key={s} value={s}>{DOCUMENT_STATUS_LABEL[s]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="exp">Validade</Label>
            <Input
              id="exp"
              type="date"
              value={expiresAt ?? doc.expires_at ?? ""}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="obs">Observação administrativa</Label>
            <Textarea
              id="obs"
              value={notes ?? doc.administrative_notes ?? ""}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={update.isPending}
            onClick={() =>
              update.mutate({
                status: status ?? doc.status,
                expires_at: expiresAt ?? doc.expires_at,
                administrative_notes: notes ?? doc.administrative_notes,
              })
            }
          >
            Salvar alterações
          </Button>
          {!doc.published_to_portal_at ? (
            <Button
              variant="secondary"
              disabled={update.isPending}
              onClick={() => update.mutate({ published_to_portal_at: new Date().toISOString(), is_draft: false })}
            >
              Publicar no portal
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={update.isPending}
            onClick={() => update.mutate({ archived_at: new Date().toISOString() })}
          >
            Arquivar
          </Button>
          <Button
            variant="outline"
            disabled={update.isPending}
            onClick={() => update.mutate({ status: "cancelado", version: doc.version + 1 })}
          >
            Cancelar registro (nova versão)
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Confirmação do colaborador">
        {query.data.acknowledgement ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="meta-mono">Visualizado em</dt><dd>{dateTimeFmt(query.data.acknowledgement.viewed_at)}</dd></div>
            <div><dt className="meta-mono">Ciência</dt><dd>{dateTimeFmt(query.data.acknowledgement.acknowledged_at)}</dd></div>
            <div><dt className="meta-mono">Assinatura</dt><dd>{dateTimeFmt(query.data.acknowledgement.signed_at)}</dd></div>
            <div><dt className="meta-mono">Localização</dt><dd>{query.data.acknowledgement.location_status}</dd></div>
            <div className="sm:col-span-2">
              <dt className="meta-mono">Hash de integridade</dt>
              <dd className="break-all text-xs">{query.data.acknowledgement.integrity_hash ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <EmptyState title="Sem confirmação" description="O colaborador ainda não confirmou este documento." />
        )}
      </SectionCard>

      <SectionCard title="Trilha de auditoria">
        {query.data.logs.length === 0 ? (
          <EmptyState title="Sem eventos" description="Visualizações, downloads e assinaturas aparecem aqui." />
        ) : (
          <ul className="divide-y-2 divide-foreground/10">
            {query.data.logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-semibold">{log.event_type}</span>
                <span className="meta-mono">{log.actor_type} · {dateTimeFmt(log.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

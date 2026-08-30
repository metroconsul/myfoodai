import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, FileText, Upload } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import { usePortalSession } from "@/hooks/use-portal-session";
import { portalMyDocuments } from "@/lib/portal-compliance.functions";
import {
  PortalCard,
  PortalChip,
  PortalEmpty,
  PortalError,
  PortalIconBox,
  PortalLabel,
  PortalLoading,
  PortalSection,
} from "@/components/portal-ui";
import { dateFmt } from "@/lib/format";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  effectiveDocumentStatus,
} from "@/lib/compliance.shared";

export const Route = createFileRoute("/portal/documentos/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Meus documentos — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Consulte exames, atestados e documentos ocupacionais publicados para você.",
      },
      { property: "og:title", content: `Meus documentos — ${BRAND_NAME}` },
      { property: "og:description", content: "Documentos ocupacionais e solicitações abertas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalDocumentsPage,
});

const CHIP_TONE: Record<string, "acid" | "warn" | "info" | "danger" | "card"> = {
  regular: "acid",
  vence_em_breve: "warn",
  vencido: "danger",
  aguardando_documento: "warn",
  em_revisao: "info",
  agendado: "info",
  cancelado: "card",
  nao_aplicavel: "card",
};

function PortalDocumentsPage() {
  const { token } = usePortalSession();
  const fetchDocs = useServerFn(portalMyDocuments);

  const query = useQuery({
    queryKey: ["portal-my-documents", token],
    enabled: !!token,
    queryFn: () => fetchDocs({ data: { token: token! } }),
  });

  if (query.isLoading) return <PortalLoading label="Carregando seus documentos…" />;
  if (query.isError || (query.data && "error" in query.data)) {
    return (
      <PortalError
        title="Não foi possível carregar seus documentos"
        description="Verifique sua conexão e tente novamente."
      />
    );
  }

  const data = query.data && !("error" in query.data) ? query.data : null;
  const documents = data?.documents ?? [];
  const requests = data?.requests ?? [];
  const acks = data?.acknowledgements ?? [];
  const ackDone = new Set(acks.filter((a) => a.acknowledged_at).map((a) => a.document_id));

  const pending = documents.filter(
    (d) =>
      (d.request_mode === "confirmar_ciencia" || d.request_mode === "assinar") &&
      !ackDone.has(d.id),
  );
  const history = documents.filter((d) => !pending.includes(d));

  return (
    <div className="space-y-6">
      <PortalCard>
        <div className="flex items-center gap-3">
          <PortalIconBox>
            <FileText className="size-5" aria-hidden />
          </PortalIconBox>
          <div>
            <PortalLabel>Meus documentos</PortalLabel>
            <p className="display-type text-xl">
              {pending.length > 0 ? `${pending.length} aguardando você` : "Tudo em dia"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Exames, atestados e documentos ocupacionais publicados pela sua empresa.
        </p>
      </PortalCard>

      {requests.length > 0 ? (
        <PortalSection title="Solicitações abertas">
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="portal-tile flex items-center gap-3 p-4">
                <PortalIconBox tone="paper">
                  <Upload className="size-5" aria-hidden />
                </PortalIconBox>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {DOCUMENT_TYPE_LABEL[r.document_type] ?? r.document_type}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.message ?? "Envie o documento solicitado."}
                    {r.due_at ? ` · prazo ${dateFmt(r.due_at)}` : ""}
                  </p>
                </div>
                <PortalChip tone="warn">Pendente</PortalChip>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            O envio de arquivos é feito na tela de pendências.
          </p>
        </PortalSection>
      ) : null}

      {pending.length > 0 ? (
        <PortalSection title="Aguardando sua confirmação">
          <ul className="space-y-3">
            {pending.map((d) => (
              <li key={d.id}>
                <Link
                  to="/portal/documentos/$id"
                  params={{ id: d.id }}
                  className="portal-press flex items-center gap-3 rounded-[24px] border-2 border-foreground bg-accent p-4 text-accent-foreground shadow-[4px_4px_0_var(--ink)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="display-type truncate text-base">{d.title}</p>
                    <p className="mt-1 text-xs font-medium">
                      {DOCUMENT_TYPE_LABEL[d.document_type] ?? d.document_type}
                      {d.expires_at ? ` · válido até ${dateFmt(d.expires_at)}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </PortalSection>
      ) : null}

      <PortalSection title="Histórico">
        {history.length === 0 ? (
          <PortalEmpty
            title="Nenhum documento publicado"
            description="Quando a empresa publicar exames ou atestados, eles aparecem aqui."
          />
        ) : (
          <ul className="space-y-3">
            {history.map((d) => {
              const effective = effectiveDocumentStatus(d.status, d.expires_at);
              return (
                <li key={d.id}>
                  <Link
                    to="/portal/documentos/$id"
                    params={{ id: d.id }}
                    className="portal-press flex items-center gap-3 rounded-[24px] border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_var(--ink)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{d.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {DOCUMENT_TYPE_LABEL[d.document_type] ?? d.document_type} ·{" "}
                        {dateFmt(d.performed_at)}
                      </p>
                    </div>
                    <PortalChip tone={CHIP_TONE[effective] ?? "card"}>
                      {DOCUMENT_STATUS_LABEL[effective] ?? effective}
                    </PortalChip>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PortalSection>
    </div>
  );
}

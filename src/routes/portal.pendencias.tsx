import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { CalendarCheck, ChevronRight, FileSignature, ListChecks, PackageCheck, Repeat, Upload } from "lucide-react";
import { toast } from "sonner";
import { BRAND_NAME } from "@/config/brand";
import { usePortalSession } from "@/hooks/use-portal-session";
import { portalPendencies, portalUploadRequestedDocument } from "@/lib/portal-compliance.functions";
import {
  PortalButton,
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
import { DOCUMENT_TYPE_LABEL } from "@/lib/compliance.shared";

export const Route = createFileRoute("/portal/pendencias")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Minhas pendências — ${BRAND_NAME}` },
      { name: "description", content: "Tudo que precisa da sua confirmação: documentos, itens, cartões de ponto e trocas." },
      { property: "og:title", content: `Minhas pendências — ${BRAND_NAME}` },
      { property: "og:description", content: "Fila única de pendências do colaborador." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPendenciesPage,
});

const MAX_FILE = 8_000_000;

function PortalPendenciesPage() {
  const { token } = usePortalSession();
  const queryClient = useQueryClient();
  const fetchPendencies = useServerFn(portalPendencies);
  const uploadFn = useServerFn(portalUploadRequestedDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeRequest, setActiveRequest] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["portal-pendencies", token],
    enabled: !!token,
    queryFn: () => fetchPendencies({ data: { token: token! } }),
  });

  const upload = useMutation({
    mutationFn: async ({ requestId, file }: { requestId: string; file: File }) => {
      if (file.size > MAX_FILE) throw new Error("Arquivo maior que 8 MB.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
      });
      const res = await uploadFn({ data: { token: token!, requestId, fileName: file.name, fileDataUrl: dataUrl } });
      if ("error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Documento enviado para análise.");
      queryClient.invalidateQueries({ queryKey: ["portal-pendencies"] });
      queryClient.invalidateQueries({ queryKey: ["portal-my-documents"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar o arquivo."),
  });

  if (query.isLoading) return <PortalLoading label="Carregando pendências…" />;
  if (query.isError || (query.data && "error" in query.data)) {
    return <PortalError title="Não foi possível carregar suas pendências" description="Tente novamente em instantes." />;
  }

  const data = query.data && !("error" in query.data) ? query.data : null;
  const requests = data?.requests ?? [];
  const documents = data?.documents ?? [];
  const deliveries = data?.deliveries ?? [];
  const pointCards = data?.pointCards ?? [];
  const exchanges = data?.exchanges ?? [];
  const total = requests.length + documents.length + deliveries.length + pointCards.length;

  return (
    <div className="space-y-6">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeRequest) upload.mutate({ requestId: activeRequest, file });
          e.target.value = "";
          setActiveRequest(null);
        }}
      />

      <PortalCard>
        <div className="flex items-center gap-3">
          <PortalIconBox>
            <ListChecks className="size-5" aria-hidden />
          </PortalIconBox>
          <div>
            <PortalLabel>Minhas pendências</PortalLabel>
            <p className="display-type text-xl">{total > 0 ? `${total} para resolver` : "Nada pendente"}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Documentos, itens e cartões de ponto que aguardam sua confirmação.
        </p>
      </PortalCard>

      {total === 0 && exchanges.length === 0 ? (
        <PortalEmpty title="Tudo em dia" description="Você não tem nenhuma pendência no momento." />
      ) : null}

      {requests.length > 0 ? (
        <PortalSection title="Documentos solicitados">
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="portal-tile p-4">
                <div className="flex items-center gap-3">
                  <PortalIconBox tone="paper">
                    <Upload className="size-5" aria-hidden />
                  </PortalIconBox>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{DOCUMENT_TYPE_LABEL[r.document_type] ?? r.document_type}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.message ?? "Envie o documento solicitado."}
                      {r.due_at ? ` · prazo ${dateFmt(r.due_at)}` : ""}
                    </p>
                  </div>
                </div>
                {r.requires_upload ? (
                  <PortalButton
                    className="mt-3"
                    block
                    variant="secondary"
                    loading={upload.isPending && activeRequest === r.id}
                    onClick={() => {
                      setActiveRequest(r.id);
                      inputRef.current?.click();
                    }}
                  >
                    Enviar arquivo
                  </PortalButton>
                ) : null}
              </li>
            ))}
          </ul>
        </PortalSection>
      ) : null}

      {documents.length > 0 ? (
        <PortalSection title="Documentos para confirmar">
          <ul className="space-y-3">
            {documents.map((d) => (
              <li key={d.id}>
                <Link
                  to="/portal/documentos/$id"
                  params={{ id: d.id }}
                  className="portal-press flex items-center gap-3 rounded-[24px] border-2 border-foreground bg-accent p-4 text-accent-foreground shadow-[4px_4px_0_var(--ink)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="display-type truncate text-base">{d.title}</p>
                    <p className="mt-1 text-xs font-medium">
                      {d.request_mode === "assinar" ? "Requer assinatura" : "Requer ciência"}
                      {d.next_action_due_at ? ` · até ${dateFmt(d.next_action_due_at)}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </PortalSection>
      ) : null}

      {deliveries.length > 0 ? (
        <PortalSection title="Itens para confirmar">
          <ul className="space-y-3">
            {deliveries.map((d) => (
              <li key={d.id}>
                <Link
                  to="/portal/itens/$id"
                  params={{ id: d.id }}
                  className="portal-press flex items-center gap-3 rounded-[24px] border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_var(--ink)]"
                >
                  <PortalIconBox tone="paper">
                    <PackageCheck className="size-5" aria-hidden />
                  </PortalIconBox>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">Entrega de itens</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Entregue em {dateFmt(d.delivered_at)}
                      {d.expires_at ? ` · prazo ${dateFmt(d.expires_at)}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </PortalSection>
      ) : null}

      {pointCards.length > 0 ? (
        <PortalSection title="Cartões de ponto para assinar">
          <ul className="space-y-3">
            {pointCards.map((c) => (
              <li key={c.id}>
                <Link
                  to="/portal/cartao-ponto/$id"
                  params={{ id: c.id }}
                  className="portal-press flex items-center gap-3 rounded-[24px] border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_var(--ink)]"
                >
                  <PortalIconBox tone="paper">
                    <FileSignature className="size-5" aria-hidden />
                  </PortalIconBox>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {dateFmt(c.period_start)} — {dateFmt(c.period_end)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.deadline_at ? `Prazo ${dateFmt(c.deadline_at)}` : "Aguardando sua assinatura"}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </PortalSection>
      ) : null}

      {exchanges.length > 0 ? (
        <PortalSection title="Trocas em andamento">
          <ul className="space-y-3">
            {exchanges.map((x) => (
              <li key={x.id} className="portal-tile flex items-center gap-3 p-4">
                <PortalIconBox tone="paper">
                  <Repeat className="size-5" aria-hidden />
                </PortalIconBox>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{x.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Solicitado em {dateFmt(x.created_at)}</p>
                </div>
                <PortalChip tone="info">Em andamento</PortalChip>
              </li>
            ))}
          </ul>
        </PortalSection>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarCheck className="size-4" aria-hidden />
        Prazos vencidos continuam disponíveis para regularização.
      </p>
    </div>
  );
}

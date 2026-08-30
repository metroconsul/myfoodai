import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Download, MapPin } from "lucide-react";
import { toast } from "sonner";
import { BRAND_NAME } from "@/config/brand";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  portalAcknowledgeDocument,
  portalDocumentDetail,
  portalDocumentFileUrl,
} from "@/lib/portal-compliance.functions";
import { SignaturePad } from "@/components/signature-pad";
import {
  PortalButton,
  PortalCard,
  PortalChip,
  PortalError,
  PortalField,
  PortalLabel,
  PortalLoading,
  PortalTile,
  portalInputClass,
} from "@/components/portal-ui";
import { dateFmt, dateTimeFmt, numberFmt } from "@/lib/format";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  DOC_TERMS,
  effectiveDocumentStatus,
} from "@/lib/compliance.shared";

export const Route = createFileRoute("/portal/documentos/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Documento — ${BRAND_NAME}` },
      {
        name: "description",
        content: "Confira o documento, baixe o arquivo e confirme sua ciência.",
      },
      { property: "og:title", content: `Documento — ${BRAND_NAME}` },
      {
        property: "og:description",
        content: "Confirmação e assinatura de documentos ocupacionais.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalDocumentDetailPage,
});

type Geo = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationStatus: "obtida" | "negada" | "imprecisa" | "indisponivel" | "nao_disponivel";
};

const NO_GEO: Geo = {
  latitude: null,
  longitude: null,
  accuracy: null,
  locationStatus: "nao_disponivel",
};

async function readLocation(): Promise<Geo> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ...NO_GEO, locationStatus: "indisponivel" };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          locationStatus: pos.coords.accuracy > 200 ? "imprecisa" : "obtida",
        }),
      () => resolve({ ...NO_GEO, locationStatus: "negada" }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

function PortalDocumentDetailPage() {
  const { id } = Route.useParams();
  const { token } = usePortalSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchDetail = useServerFn(portalDocumentDetail);
  const fileUrlFn = useServerFn(portalDocumentFileUrl);
  const ackFn = useServerFn(portalAcknowledgeDocument);

  const [signMode, setSignMode] = useState<"desenhada" | "digitada">("desenhada");
  const [signature, setSignature] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);

  const query = useQuery({
    queryKey: ["portal-document", id, token],
    enabled: !!token,
    queryFn: () => fetchDetail({ data: { token: token!, documentId: id } }),
  });

  const openFile = useMutation({
    mutationFn: async () => {
      const res = await fileUrlFn({ data: { token: token!, documentId: id } });
      if ("error" in res && res.error) throw new Error(res.error);
      if ("url" in res && res.url) window.open(res.url, "_blank", "noopener");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Arquivo indisponível."),
  });

  const confirm = useMutation({
    mutationFn: async (mode: "ciencia" | "assinatura") => {
      const geo = await readLocation();
      const res = await ackFn({
        data: {
          token: token!,
          documentId: id,
          mode,
          signatureDataUrl: mode === "assinatura" && signMode === "desenhada" ? signature : null,
          typedName: mode === "assinatura" && signMode === "digitada" ? typedName : null,
          ...geo,
          deviceInfo: navigator.userAgent.slice(0, 300),
        },
      });
      if ("error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      setDone(true);
      toast.success("Confirmação registrada.");
      queryClient.invalidateQueries({ queryKey: ["portal-my-documents"] });
      queryClient.invalidateQueries({ queryKey: ["portal-pendencies"] });
      queryClient.invalidateQueries({ queryKey: ["portal-document", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível confirmar."),
  });

  if (query.isLoading) return <PortalLoading label="Carregando documento…" />;
  if (query.isError || (query.data && "error" in query.data)) {
    return (
      <PortalError
        title="Documento indisponível"
        description="Ele pode ter sido arquivado ou sua sessão expirou."
        action={
          <PortalButton variant="dark" onClick={() => void navigate({ to: "/portal/documentos" })}>
            Voltar
          </PortalButton>
        }
      />
    );
  }

  const data = query.data && !("error" in query.data) ? query.data : null;
  const doc = data?.document;
  if (!doc) return <PortalError title="Documento não encontrado" />;

  const effective = effectiveDocumentStatus(doc.status, doc.expires_at);
  const alreadyDone = done || !!data?.acknowledgement?.acknowledged_at;
  const needsSignature = doc.request_mode === "assinar";
  const needsAck = doc.request_mode === "confirmar_ciencia" || needsSignature;

  return (
    <div className="space-y-5">
      <Link
        to="/portal/documentos"
        className="portal-press inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-foreground bg-card px-4 text-sm font-bold shadow-[2px_2px_0_var(--ink)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Meus documentos
      </Link>

      <PortalCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PortalLabel>{DOCUMENT_TYPE_LABEL[doc.document_type] ?? doc.document_type}</PortalLabel>
          <PortalChip
            tone={effective === "regular" ? "acid" : effective === "vencido" ? "danger" : "warn"}
          >
            {DOCUMENT_STATUS_LABEL[effective] ?? effective}
          </PortalChip>
        </div>
        <p className="display-type mt-2 text-xl">{doc.title}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <PortalTile>
            <PortalLabel>Realização</PortalLabel>
            <p className="mt-1 font-bold">{dateFmt(doc.performed_at)}</p>
          </PortalTile>
          <PortalTile>
            <PortalLabel>Validade</PortalLabel>
            <p className="mt-1 font-bold">{dateFmt(doc.expires_at)}</p>
          </PortalTile>
        </div>

        {doc.next_action ? (
          <p className="mt-4 rounded-[16px] border-2 border-foreground bg-secondary p-3 text-sm">
            Próxima ação: {doc.next_action}
            {doc.next_action_due_at ? ` · até ${dateFmt(doc.next_action_due_at)}` : ""}
          </p>
        ) : null}

        {doc.file_path ? (
          <PortalButton
            className="mt-4"
            block
            variant="secondary"
            loading={openFile.isPending}
            onClick={() => openFile.mutate()}
          >
            <Download className="size-4" aria-hidden />
            Abrir arquivo
          </PortalButton>
        ) : null}
      </PortalCard>

      {alreadyDone ? (
        <PortalCard>
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-foreground bg-accent text-accent-foreground">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <div>
              <p className="display-type text-lg">Confirmação registrada</p>
              <p className="text-sm text-muted-foreground">
                {dateTimeFmt(data?.acknowledgement?.acknowledged_at ?? new Date().toISOString())}
              </p>
            </div>
          </div>
          <PortalButton
            className="mt-4"
            variant="dark"
            block
            onClick={() => void navigate({ to: "/portal/documentos" })}
          >
            Voltar
          </PortalButton>
        </PortalCard>
      ) : needsAck ? (
        <PortalCard>
          <p className="display-type text-lg">
            {needsSignature ? "Assine para confirmar" : "Confirme sua ciência"}
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {DOC_TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>

          {needsSignature ? (
            <>
              <div className="mt-4 flex gap-2">
                <PortalButton
                  type="button"
                  variant={signMode === "desenhada" ? "primary" : "secondary"}
                  onClick={() => setSignMode("desenhada")}
                >
                  Desenhar
                </PortalButton>
                <PortalButton
                  type="button"
                  variant={signMode === "digitada" ? "primary" : "secondary"}
                  onClick={() => setSignMode("digitada")}
                >
                  Digitar nome
                </PortalButton>
              </div>
              <div className="mt-4">
                {signMode === "desenhada" ? (
                  <SignaturePad onChange={setSignature} />
                ) : (
                  <PortalField id="doc-typed-name" label="Nome completo">
                    <input
                      id="doc-typed-name"
                      className={portalInputClass}
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      autoComplete="name"
                    />
                  </PortalField>
                )}
              </div>
            </>
          ) : null}

          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-5 shrink-0 rounded-[6px] border-2 border-foreground accent-[var(--acid)]"
            />
            <span>Li o documento e confirmo o registro eletrônico desta confirmação.</span>
          </label>

          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-4" aria-hidden />A localização aproximada é registrada como
            evidência quando você permite.
          </p>

          <PortalButton
            className="mt-4"
            block
            loading={confirm.isPending}
            disabled={
              !agreed ||
              (needsSignature &&
                (signMode === "desenhada" ? !signature : typedName.trim().length < 3))
            }
            onClick={() => confirm.mutate(needsSignature ? "assinatura" : "ciencia")}
          >
            {needsSignature ? "Assinar documento" : "Confirmar ciência"}
          </PortalButton>
        </PortalCard>
      ) : (
        <PortalCard>
          <p className="text-sm text-muted-foreground">
            Este documento é apenas informativo e não exige confirmação.
          </p>
        </PortalCard>
      )}

      {data?.acknowledgement?.accuracy_meters ? (
        <p className="meta-mono">
          Precisão da localização registrada: ±
          {numberFmt(Number(data.acknowledgement.accuracy_meters), 0)} m
        </p>
      ) : null}
    </div>
  );
}

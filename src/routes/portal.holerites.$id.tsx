import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Download, FileText, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BRAND_NAME } from "@/config/brand";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  portalOpenPayslipDispute,
  portalPayslipDetail,
  portalPayslipFaceCheck,
  portalSignPayslip,
} from "@/lib/portal-payslips.functions";
import {
  PortalButton,
  PortalCard,
  PortalChip,
  PortalError,
  PortalField,
  PortalLabel,
  PortalLoading,
  PortalSection,
  portalInputClass,
} from "@/components/portal-ui";
import { SelfieCapture } from "@/components/selfie-capture";
import { SignaturePad } from "@/components/signature-pad";
import { LgpdConsent } from "@/components/lgpd-consent";
import { EMPTY_LGPD_CONSENT, type LgpdConsent as Consent } from "@/lib/lgpd.shared";
import { dateTimeFmt, dateFmt } from "@/lib/format";
import {
  DISPUTE_CATEGORIES,
  DISPUTE_CATEGORY_LABEL,
  DISPUTE_STATUS_LABEL,
  PAYSLIP_STATUS_LABEL,
  PAYSLIP_TERM_TEXT,
  competenceLabel,
  formatBytes,
  requiresAcceptance,
  requiresFace,
  requiresSignature,
  shortHash,
} from "@/lib/payslips.shared";

export const Route = createFileRoute("/portal/holerites/$id")({
  head: () => ({
    meta: [
      { title: `Holerite — ${BRAND_NAME}` },
      { name: "description", content: "Confira o documento e registre seu aceite eletrônico." },
      { property: "og:title", content: `Holerite — ${BRAND_NAME}` },
      { property: "og:description", content: "Conferência e assinatura eletrônica do holerite." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayslipDetail,
});

type Geo = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationStatus: "obtida" | "negada" | "imprecisa" | "indisponivel" | "nao_disponivel";
};

const EMPTY_GEO: Geo = {
  latitude: null,
  longitude: null,
  accuracy: null,
  locationStatus: "nao_disponivel",
};

function PayslipDetail() {
  const { id } = useParams({ from: "/portal/holerites/$id" });
  const { token, ready } = usePortalSession();
  const queryClient = useQueryClient();

  const detailFn = useServerFn(portalPayslipDetail);
  const faceFn = useServerFn(portalPayslipFaceCheck);
  const signFn = useServerFn(portalSignPayslip);
  const disputeFn = useServerFn(portalOpenPayslipDispute);

  const [consent, setConsent] = useState<Consent>(EMPTY_LGPD_CONSENT);
  const [geo, setGeo] = useState<Geo>(EMPTY_GEO);
  const [faceStatus, setFaceStatus] = useState<
    "not_required" | "not_started" | "approved" | "rejected" | "provider_unavailable"
  >("not_started");
  const [faceRef, setFaceRef] = useState<string | null>(null);
  const [faceLiveness, setFaceLiveness] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<string>("valor");
  const [disputeText, setDisputeText] = useState("");

  const query = useQuery({
    queryKey: ["portal-payslip", id, token],
    enabled: !!token,
    queryFn: () => detailFn({ data: { token: token!, payslipId: id } }),
  });

  const data = query.data && !("error" in query.data) ? query.data : null;
  const payslip = data?.payslip;
  const policy = payslip?.acceptance_policy ?? "visualizacao";

  const askLocation = () => {
    if (!navigator.geolocation) {
      setGeo({ ...EMPTY_GEO, locationStatus: "indisponivel" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeo({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          locationStatus: pos.coords.accuracy > 200 ? "imprecisa" : "obtida",
        }),
      () => setGeo({ ...EMPTY_GEO, locationStatus: "negada" }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const face = useMutation({
    mutationFn: async (imageDataUrl: string) =>
      faceFn({
        data: {
          token: token!,
          payslipId: id,
          imageDataUrl,
          consentData: consent.data,
          consentBiometrics: consent.biometrics,
          consentLocation: consent.location,
        },
      }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setFaceStatus(res.status as typeof faceStatus);
      setFaceRef(res.reference);
      setFaceLiveness(res.liveness);
      if (res.status === "approved") toast.success("Identidade validada.");
      else toast.error(res.message ?? "Não conseguimos validar sua identidade. Tente novamente.");
    },
    onError: () => toast.error("Falha ao validar identidade."),
  });

  const sign = useMutation({
    mutationFn: async () =>
      signFn({
        data: {
          token: token!,
          payslipId: id,
          mode: requiresSignature(policy) ? ("assinatura" as const) : ("ciencia" as const),
          signatureDataUrl,
          typedName: typedName.trim() || null,
          faceStatus: requiresFace(policy) ? faceStatus : ("not_required" as const),
          faceProviderRef: faceRef,
          faceLiveness,
          deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracy: geo.accuracy,
          locationStatus: geo.locationStatus,
          consentData: consent.data,
          consentBiometrics: consent.biometrics,
          consentLocation: consent.location,
        },
      }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Aceite registrado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["portal-payslip", id] });
      queryClient.invalidateQueries({ queryKey: ["portal-payslips"] });
    },
    onError: () => toast.error("Não foi possível registrar o aceite."),
  });

  const dispute = useMutation({
    mutationFn: async () =>
      disputeFn({
        data: {
          token: token!,
          payslipId: id,
          category: disputeCategory as (typeof DISPUTE_CATEGORIES)[number],
          description: disputeText.trim(),
        },
      }),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Divergência enviada ao RH.");
      setDisputeOpen(false);
      setDisputeText("");
      queryClient.invalidateQueries({ queryKey: ["portal-payslip", id] });
    },
    onError: () => toast.error("Não foi possível enviar a divergência."),
  });

  if (!ready) return <PortalLoading label="Carregando…" />;
  if (!token) return <PortalError title="Sessão encerrada" description="Entre novamente no portal." />;
  if (query.isLoading) return <PortalLoading rows={4} label="Abrindo documento…" />;
  if (query.isError || !data || !payslip)
    return (
      <PortalError
        title="Documento indisponível"
        description="Ele pode ter sido cancelado ou substituído por uma nova versão."
      />
    );

  const signed = payslip.status === "signed";
  const needsAcceptance = requiresAcceptance(policy) && !signed;
  const canSign =
    consent.data &&
    (!requiresFace(policy) || faceStatus === "approved") &&
    (!requiresSignature(policy) || !!signatureDataUrl || typedName.trim().length >= 3);

  return (
    <div className="space-y-6">
      <PortalSection title={`Holerite ${competenceLabel(payslip.payroll_period)}`}>
        <PortalCard className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <PortalChip tone={signed ? "acid" : "card"}>
              {PAYSLIP_STATUS_LABEL[payslip.status] ?? payslip.status}
            </PortalChip>
            <PortalChip tone="info">Versão {payslip.current_version}</PortalChip>
            {payslip.due_at ? <PortalChip tone="warn">Prazo {dateFmt(payslip.due_at)}</PortalChip> : null}
          </div>
          <div className="grid gap-1">
            <PortalLabel>Documento</PortalLabel>
            <p className="text-sm font-semibold">{data.version?.fileName ?? "Holerite"}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(data.version?.sizeBytes)} · SHA-256 {shortHash(data.version?.fileSha256)}
            </p>
          </div>
          {data.version?.correctionReason ? (
            <p className="rounded-[16px] border-2 border-foreground bg-warning p-3 text-xs">
              Documento corrigido: {data.version.correctionReason}
            </p>
          ) : null}
          {data.url ? (
            <>
              <div className="overflow-hidden rounded-[20px] border-2 border-foreground">
                {data.version?.mimeType === "application/pdf" ? (
                  <object data={data.url} type="application/pdf" className="h-[420px] w-full">
                    <p className="p-4 text-sm">
                      Não foi possível exibir o PDF aqui. Use o botão abaixo para abrir.
                    </p>
                  </object>
                ) : (
                  <img src={data.url} alt="Holerite" className="w-full" />
                )}
              </div>
              <a
                href={data.url}
                target="_blank"
                rel="noreferrer"
                className="portal-press inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-foreground bg-card px-5 text-sm font-bold shadow-[3px_3px_0_var(--ink)]"
              >
                <Download className="size-4" aria-hidden />
                Abrir documento
              </a>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Arquivo indisponível no momento.</p>
          )}
        </PortalCard>
      </PortalSection>

      {signed ? (
        <PortalSection title="Comprovante">
          <PortalCard className="space-y-2 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4" aria-hidden /> Assinado em{" "}
              {dateTimeFmt(payslip.signed_at)}
            </p>
            <p className="text-xs text-muted-foreground">
              Hash de integridade: {shortHash(data.signature?.integrity_hash)}
            </p>
            {data.signature?.geo_address ? (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {data.signature.geo_address}
              </p>
            ) : null}
            <Link
              to="/portal/holerites/$id/comprovante"
              params={{ id }}
              className="portal-press mt-2 inline-flex min-h-[52px] w-full items-center justify-center rounded-[16px] border-2 border-foreground bg-accent px-5 text-sm font-bold shadow-[3px_3px_0_var(--ink)]"
            >
              Ver comprovante completo
            </Link>
          </PortalCard>
        </PortalSection>
      ) : null}

      {needsAcceptance ? (
        <PortalSection title="Conferência e aceite">
          <PortalCard className="space-y-4 p-4">
            <p className="text-sm">{PAYSLIP_TERM_TEXT}</p>

            <LgpdConsent
              value={consent}
              onChange={(next) => {
                setConsent(next);
                if (next.location && geo.locationStatus === "nao_disponivel") askLocation();
              }}
              withBiometrics={requiresFace(policy)}
            />

            {requiresFace(policy) ? (
              <div className="space-y-2">
                <PortalLabel>Validação de identidade</PortalLabel>
                {faceStatus === "approved" ? (
                  <PortalChip tone="acid">Identidade validada</PortalChip>
                ) : (
                  <SelfieCapture
                    disabled={!consent.data || !consent.biometrics || face.isPending}
                    onCapture={(dataUrl) => face.mutate(dataUrl)}
                    onFallback={() =>
                      toast.info("Sem câmera disponível. Procure o RH para concluir o aceite.")
                    }
                  />
                )}
              </div>
            ) : null}

            {requiresSignature(policy) ? (
              <div className="space-y-3">
                <SignaturePad onChange={setSignatureDataUrl} />
                <PortalField id="payslip-typed-name" label="Ou digite seu nome completo">
                  <input
                    id="payslip-typed-name"
                    className={portalInputClass}
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </PortalField>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Localização: {geo.locationStatus === "obtida" ? "capturada" : "não capturada"}
            </p>

            <PortalButton block loading={sign.isPending} disabled={!canSign} onClick={() => sign.mutate()}>
              {requiresSignature(policy) ? "Assinar holerite" : "Confirmar ciência"}
            </PortalButton>
          </PortalCard>
        </PortalSection>
      ) : null}

      <PortalSection title="Divergências">
        {data.disputes.length ? (
          <ul className="space-y-2">
            {data.disputes.map((d) => (
              <li key={d.id} className="rounded-[20px] border-2 border-foreground bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <PortalChip tone={d.status === "resolvida" ? "acid" : "warn"}>
                    {DISPUTE_STATUS_LABEL[d.status] ?? d.status}
                  </PortalChip>
                  <PortalChip tone="card">{DISPUTE_CATEGORY_LABEL[d.category] ?? d.category}</PortalChip>
                </div>
                <p className="mt-2 text-sm">{d.description}</p>
                {d.hr_response ? (
                  <p className="mt-2 rounded-[14px] border-2 border-foreground bg-secondary p-3 text-xs">
                    Resposta do RH: {d.hr_response}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {disputeOpen ? (
          <PortalCard className="space-y-3 p-4">
            <PortalField id="dispute-category" label="Categoria">
              <select
                id="dispute-category"
                className={portalInputClass}
                value={disputeCategory}
                onChange={(e) => setDisputeCategory(e.target.value)}
              >
                {DISPUTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DISPUTE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </PortalField>
            <PortalField id="dispute-description" label="Descreva a divergência">
              <textarea
                id="dispute-description"
                className={`${portalInputClass} min-h-28 py-3`}
                value={disputeText}
                onChange={(e) => setDisputeText(e.target.value)}
                placeholder="Explique o que precisa ser verificado (mínimo 10 caracteres)."
              />
            </PortalField>
            <div className="flex gap-2">
              <PortalButton
                block
                loading={dispute.isPending}
                disabled={disputeText.trim().length < 10}
                onClick={() => dispute.mutate()}
              >
                Enviar ao RH
              </PortalButton>
              <PortalButton variant="secondary" onClick={() => setDisputeOpen(false)}>
                Cancelar
              </PortalButton>
            </div>
          </PortalCard>
        ) : (
          <PortalButton variant="secondary" block onClick={() => setDisputeOpen(true)}>
            <AlertTriangle className="size-4" aria-hidden />
            Informar divergência
          </PortalButton>
        )}
      </PortalSection>

      <Link
        to="/portal/holerites"
        className="portal-press inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-foreground bg-card px-5 text-sm font-bold shadow-[3px_3px_0_var(--ink)]"
      >
        <FileText className="size-4" aria-hidden />
        Voltar aos holerites
      </Link>
    </div>
  );
}

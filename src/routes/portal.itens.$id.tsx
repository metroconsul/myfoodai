import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  portalAcceptDelivery,
  portalItemDelivery,
  portalRefuseDelivery,
  portalValidateIdentity,
} from "@/lib/portal-items.functions";
import { SelfieCapture } from "@/components/selfie-capture";
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
import { dateTimeFmt, numberFmt } from "@/lib/format";
import { RECEIPT_TERMS, STATUS_LABEL } from "@/lib/items.shared";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/itens/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Confirmar recebimento — ${BRAND_NAME}` },
      { name: "description", content: "Confira os itens recebidos, valide sua identidade e assine o comprovante." },
      { property: "og:title", content: `Confirmar recebimento — ${BRAND_NAME}` },
      { property: "og:description", content: "Aceite de itens com validação de identidade e assinatura." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalItemAcceptPage,
});

type Geo = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationStatus: "obtida" | "negada" | "imprecisa" | "indisponivel" | "nao_disponivel";
};

const NO_GEO: Geo = { latitude: null, longitude: null, accuracy: null, locationStatus: "nao_disponivel" };

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

type Step = "conferencia" | "identidade" | "assinatura" | "concluido";

function PortalItemAcceptPage() {
  const { id } = Route.useParams();
  const { token } = usePortalSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchDetail = useServerFn(portalItemDelivery);
  const validateFn = useServerFn(portalValidateIdentity);
  const acceptFn = useServerFn(portalAcceptDelivery);
  const refuseFn = useServerFn(portalRefuseDelivery);

  const [step, setStep] = useState<Step>("conferencia");
  const [geo, setGeo] = useState<Geo>(NO_GEO);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [faceOk, setFaceOk] = useState(false);
  const [faceSkipReason, setFaceSkipReason] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<"desenhada" | "digitada">("desenhada");
  const [signature, setSignature] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [refuseMode, setRefuseMode] = useState<"recusado" | "divergente" | null>(null);
  const [refuseReason, setRefuseReason] = useState("");

  const query = useQuery({
    queryKey: ["portal-item-delivery", id, token],
    enabled: !!token,
    queryFn: () => fetchDetail({ data: { token: token!, deliveryId: id } }),
  });

  const startAccept = async () => {
    setGeo(await readLocation());
    setStep("identidade");
  };

  const validate = useMutation({
    mutationFn: async () => {
      if (!selfie) throw new Error("Capture a selfie para continuar.");
      const res = await validateFn({
        data: {
          token: token!,
          deliveryId: id,
          imageDataUrl: selfie,
          ...geo,
          deviceInfo: navigator.userAgent.slice(0, 300),
        },
      });
      if ("error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      if ("status" in res && res.status === "aprovado") {
        setFaceOk(true);
        setStep("assinatura");
        toast.success("Identidade validada.");
      } else {
        const message = ("message" in res && res.message) || "Não foi possível validar sua identidade.";
        toast.error(message);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro na validação."),
  });

  const accept = useMutation({
    mutationFn: async () => {
      if (!agreed) throw new Error("Confirme a leitura do termo para assinar.");
      const res = await acceptFn({
        data: {
          token: token!,
          deliveryId: id,
          signatureType: signatureMode,
          signatureDataUrl: signatureMode === "desenhada" ? signature : null,
          typedName: signatureMode === "digitada" ? typedName : null,
          ...geo,
          deviceInfo: navigator.userAgent.slice(0, 300),
          faceSkipReason,
        },
      });
      if ("error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      setStep("concluido");
      queryClient.invalidateQueries({ queryKey: ["portal-my-items"] });
      queryClient.invalidateQueries({ queryKey: ["portal-item-delivery", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar o aceite."),
  });

  const refuse = useMutation({
    mutationFn: async () => {
      const res = await refuseFn({
        data: { token: token!, deliveryId: id, mode: refuseMode!, reason: refuseReason.trim() },
      });
      if ("error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Registro enviado para a gestão.");
      setRefuseMode(null);
      setRefuseReason("");
      queryClient.invalidateQueries({ queryKey: ["portal-my-items"] });
      void navigate({ to: "/portal/itens" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar."),
  });

  if (query.isLoading) return <PortalLoading label="Carregando entrega…" />;
  if (query.isError || (query.data && "error" in query.data)) {
    return (
      <PortalError
        title="Entrega indisponível"
        description="Ela pode ter sido cancelada ou sua sessão expirou."
        action={
          <PortalButton variant="dark" onClick={() => void navigate({ to: "/portal/itens" })}>
            Voltar
          </PortalButton>
        }
      />
    );
  }

  const data = query.data && !("error" in query.data) ? query.data : null;
  const delivery = data?.delivery;
  if (!delivery) return <PortalError title="Entrega não encontrada" />;

  const items = delivery.item_delivery_items ?? [];
  const pendente = delivery.status === "aguardando_aceite" || delivery.status === "em_validacao";

  return (
    <div className="space-y-5">
      <Link
        to="/portal/itens"
        className="portal-press inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-foreground bg-card px-4 text-sm font-bold shadow-[2px_2px_0_var(--ink)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Meus itens
      </Link>

      <PortalCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PortalLabel>Entrega de itens</PortalLabel>
          <PortalChip tone={delivery.status === "assinado" ? "acid" : pendente ? "warn" : "card"}>
            {STATUS_LABEL[delivery.status] ?? delivery.status}
          </PortalChip>
        </div>
        <p className="display-type mt-2 text-xl">{items.length} item(ns)</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.unitName ? `${data.unitName} · ` : ""}
          Entregue em {dateTimeFmt(delivery.delivered_at)}
          {delivery.responsible_label ? ` por ${delivery.responsible_label}` : ""}
        </p>

        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <PortalTile>
                <p className="font-bold">{item.item_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {numberFmt(Number(item.quantity))}
                  {item.size ? ` · tam. ${item.size}` : ""}
                  {item.color ? ` · ${item.color}` : ""}
                  {item.lot ? ` · lote ${item.lot}` : ""}
                </p>
              </PortalTile>
            </li>
          ))}
        </ul>

        {delivery.notes ? (
          <p className="mt-4 rounded-[16px] border-2 border-foreground bg-secondary p-3 text-sm">
            {delivery.notes}
          </p>
        ) : null}
      </PortalCard>

      {delivery.status === "assinado" || step === "concluido" ? (
        <PortalCard>
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-foreground bg-accent text-accent-foreground">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <div>
              <p className="display-type text-lg">Recebimento confirmado</p>
              <p className="text-sm text-muted-foreground">
                {dateTimeFmt(delivery.accepted_at ?? new Date().toISOString())}
              </p>
            </div>
          </div>
          {data?.evidence?.integrity_hash ? (
            <p className="meta-mono mt-4 break-all">Código do comprovante: {data.evidence.integrity_hash.slice(0, 24)}</p>
          ) : null}
          <PortalButton
            className="mt-4"
            variant="dark"
            block
            onClick={() => void navigate({ to: "/portal/itens" })}
          >
            Voltar para meus itens
          </PortalButton>
        </PortalCard>
      ) : null}

      {pendente && step === "conferencia" ? (
        <PortalCard>
          <p className="display-type text-lg">Confira antes de confirmar</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {RECEIPT_TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="mt-5 space-y-2">
            <PortalButton block onClick={() => void startAccept()}>
              <ShieldCheck className="size-4" aria-hidden />
              Recebi os itens — confirmar
            </PortalButton>
            <PortalButton block variant="secondary" onClick={() => setRefuseMode("divergente")}>
              Recebi com divergência
            </PortalButton>
            <PortalButton block variant="secondary" onClick={() => setRefuseMode("recusado")}>
              Não recebi estes itens
            </PortalButton>
          </div>
        </PortalCard>
      ) : null}

      {pendente && step === "identidade" ? (
        <PortalCard>
          <PortalLabel>Etapa 1 de 2</PortalLabel>
          <p className="display-type mt-1 text-lg">Validação de identidade</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A selfie é usada apenas como evidência deste recebimento.
          </p>

          <div className="mt-4">
            <SelfieCapture
              onCapture={(dataUrl) => setSelfie(dataUrl)}
              onFallback={() => {
                setFaceSkipReason("Câmera indisponível no dispositivo do colaborador.");
                setStep("assinatura");
                toast.info("Seguindo sem validação facial. A gestão será informada.");
              }}
              disabled={validate.isPending}
            />
          </div>

          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-4" aria-hidden />
            {geo.locationStatus === "obtida"
              ? `Localização registrada (±${numberFmt(geo.accuracy ?? 0, 0)} m)`
              : geo.locationStatus === "imprecisa"
                ? "Localização imprecisa registrada"
                : "Localização não disponível — o aceite continua válido"}
          </p>

          <PortalButton
            className="mt-4"
            block
            loading={validate.isPending}
            disabled={!selfie}
            onClick={() => validate.mutate()}
          >
            Validar e continuar
          </PortalButton>
        </PortalCard>
      ) : null}

      {pendente && step === "assinatura" ? (
        <PortalCard>
          <PortalLabel>Etapa 2 de 2</PortalLabel>
          <p className="display-type mt-1 text-lg">Assinatura do comprovante</p>
          {faceOk ? (
            <PortalChip tone="acid" className="mt-2">
              Identidade validada
            </PortalChip>
          ) : (
            <PortalChip tone="warn" className="mt-2">
              Sem validação facial
            </PortalChip>
          )}

          <div className="mt-4 flex gap-2">
            <PortalButton
              type="button"
              variant={signatureMode === "desenhada" ? "primary" : "secondary"}
              onClick={() => setSignatureMode("desenhada")}
            >
              Desenhar
            </PortalButton>
            <PortalButton
              type="button"
              variant={signatureMode === "digitada" ? "primary" : "secondary"}
              onClick={() => setSignatureMode("digitada")}
            >
              Digitar nome
            </PortalButton>
          </div>

          <div className="mt-4">
            {signatureMode === "desenhada" ? (
              <SignaturePad onChange={setSignature} />
            ) : (
              <PortalField id="typed-name" label="Nome completo" hint="Confirma o aceite eletrônico deste comprovante.">
                <input
                  id="typed-name"
                  className={portalInputClass}
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  autoComplete="name"
                />
              </PortalField>
            )}
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-5 shrink-0 rounded-[6px] border-2 border-foreground accent-[var(--acid)]"
            />
            <span>Li e concordo com o termo de recebimento e uso dos itens.</span>
          </label>

          <PortalButton
            className="mt-4"
            block
            loading={accept.isPending}
            disabled={!agreed || (signatureMode === "desenhada" ? !signature : typedName.trim().length < 3)}
            onClick={() => accept.mutate()}
          >
            Assinar e confirmar recebimento
          </PortalButton>
        </PortalCard>
      ) : null}

      {refuseMode ? (
        <PortalCard>
          <p className="display-type text-lg">
            {refuseMode === "recusado" ? "Não recebi estes itens" : "Recebi com divergência"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Descreva o que aconteceu. A gestão da sua unidade será avisada.
          </p>
          <PortalField id="refuse-reason" label="Motivo">
            <textarea
              id="refuse-reason"
              rows={4}
              className={`${portalInputClass} h-auto py-3`}
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
            />
          </PortalField>
          <div className="mt-4 flex gap-2">
            <PortalButton
              block
              loading={refuse.isPending}
              disabled={refuseReason.trim().length < 3}
              onClick={() => refuse.mutate()}
            >
              Enviar
            </PortalButton>
            <PortalButton variant="secondary" onClick={() => setRefuseMode(null)}>
              Voltar
            </PortalButton>
          </div>
        </PortalCard>
      ) : null}
    </div>
  );
}

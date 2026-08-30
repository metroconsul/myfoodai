import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  portalCreateTimesheetDispute,
  portalSignTimesheet,
  portalTimesheetCard,
  portalValidateTimesheetIdentity,
} from "@/lib/portal-timesheet.functions";
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
import { dateFmt, dateTimeFmt, minutesToHours } from "@/lib/format";
import {
  ALERT_LABEL,
  CARD_STATUS_LABEL,
  CARD_STATUS_MESSAGE,
  DISPUTE_CATEGORIES,
  DISPUTE_CATEGORY_LABEL,
  DISPUTE_STATUS_LABEL,
  OPEN_FOR_SIGNATURE,
  TIMESHEET_DISCLAIMER,
  TIMESHEET_TERM,
  monthLabel,
} from "@/lib/timesheet.shared";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/cartao-ponto/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Conferir cartão de ponto — ${BRAND_NAME}` },
      { name: "description", content: "Confira seu cartão de ponto, aponte divergências e assine digitalmente." },
      { property: "og:title", content: `Conferir cartão de ponto — ${BRAND_NAME}` },
      { property: "og:description", content: "Aceite eletrônico do cartão de ponto com validação e geolocalização." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalTimesheetCardPage,
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

function PortalTimesheetCardPage() {
  const { id } = Route.useParams();
  const { token } = usePortalSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchCard = useServerFn(portalTimesheetCard);
  const validateFn = useServerFn(portalValidateTimesheetIdentity);
  const signFn = useServerFn(portalSignTimesheet);
  const disputeFn = useServerFn(portalCreateTimesheetDispute);

  const [step, setStep] = useState<Step>("conferencia");
  const [geo, setGeo] = useState<Geo>(NO_GEO);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [faceSkipReason, setFaceSkipReason] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<"desenhada" | "digitada">("desenhada");
  const [signature, setSignature] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<string>("entrada");
  const [disputeDate, setDisputeDate] = useState("");
  const [disputeText, setDisputeText] = useState("");

  const query = useQuery({
    queryKey: ["portal-card", id, token],
    enabled: !!token,
    queryFn: () => fetchCard({ data: { token: token!, cardId: id } }),
  });

  const startSign = async () => {
    setGeo(await readLocation());
    setStep("identidade");
  };

  const validate = useMutation({
    mutationFn: async () => {
      if (!selfie) throw new Error("Capture a selfie para continuar.");
      const res = await validateFn({
        data: {
          token: token!,
          cardId: id,
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
        setStep("assinatura");
        toast.success("Identidade validada.");
      } else {
        toast.error(("message" in res && res.message) || "Não foi possível validar sua identidade.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro na validação."),
  });

  const sign = useMutation({
    mutationFn: async () => {
      const res = await signFn({
        data: {
          token: token!,
          cardId: id,
          signatureType: signatureMode,
          signatureDataUrl: signatureMode === "desenhada" ? signature : null,
          typedName: signatureMode === "digitada" ? typedName : null,
          agreed,
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
      void queryClient.invalidateQueries({ queryKey: ["portal-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["portal-card", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao assinar."),
  });

  const dispute = useMutation({
    mutationFn: async () => {
      const res = await disputeFn({
        data: {
          token: token!,
          cardId: id,
          category: disputeCategory as (typeof DISPUTE_CATEGORIES)[number],
          workDate: disputeDate || null,
          description: disputeText.trim(),
        },
      });
      if ("error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Divergência enviada para análise.");
      setDisputeOpen(false);
      setDisputeText("");
      void queryClient.invalidateQueries({ queryKey: ["portal-card", id] });
      void queryClient.invalidateQueries({ queryKey: ["portal-cards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar divergência."),
  });

  if (query.isLoading) return <PortalLoading label="Carregando cartão…" />;
  if (query.isError || (query.data && "error" in query.data)) {
    return (
      <PortalError
        title="Cartão indisponível"
        description="Ele pode não estar publicado ou sua sessão expirou."
        action={
          <PortalButton variant="dark" onClick={() => void navigate({ to: "/portal/cartao-ponto" })}>
            Voltar
          </PortalButton>
        }
      />
    );
  }

  const data = query.data && !("error" in query.data) ? query.data : null;
  const card = data?.card;
  if (!card) return <PortalError title="Cartão não encontrado" />;

  const entries = data?.entries ?? [];
  const disputes = data?.disputes ?? [];
  const evidence = data?.evidence ?? null;
  const canSign = OPEN_FOR_SIGNATURE.includes(card.status);

  if (step === "concluido" || card.status === "assinado") {
    return (
      <div className="space-y-5">
        <PortalCard className="p-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full border-2 border-foreground bg-accent">
            <CheckCircle2 className="size-7" aria-hidden />
          </span>
          <h1 className="display-type mt-3 text-2xl">Cartão assinado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu aceite foi registrado com data, hora e evidências. Guarde o comprovante abaixo.
          </p>
          {evidence?.integrity_hash ? (
            <p className="mt-3 break-all rounded-[12px] border-2 border-foreground bg-background p-3 font-mono text-[11px]">
              {evidence.integrity_hash}
            </p>
          ) : null}
          {card.signed_at ? (
            <p className="mt-2 text-xs text-muted-foreground">Assinado em {dateTimeFmt(card.signed_at)}</p>
          ) : null}
          <PortalButton
            block
            className="mt-4"
            variant="dark"
            onClick={() => void navigate({ to: "/portal/cartao-ponto" })}
          >
            Voltar aos meus cartões
          </PortalButton>
        </PortalCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => void navigate({ to: "/portal/cartao-ponto" })}
        className="portal-press inline-flex items-center gap-2 text-sm font-bold"
      >
        <ArrowLeft className="size-4" aria-hidden /> Meus cartões
      </button>

      <PortalCard className="p-6">
        <PortalLabel>Período</PortalLabel>
        <h1 className="display-type mt-1 text-2xl capitalize">{monthLabel(card.period_start)}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {dateFmt(card.period_start)} — {dateFmt(card.period_end)} · versão {card.version ?? 1}
        </p>
        <div className="mt-3">
          <PortalChip tone={card.status === "divergente" ? "danger" : "warn"}>
            {CARD_STATUS_LABEL[card.status] ?? card.status}
          </PortalChip>
        </div>
        <p className="mt-2 text-sm">{CARD_STATUS_MESSAGE[card.status] ?? ""}</p>
        {card.deadline_at ? (
          <p className="mt-2 text-xs text-muted-foreground">Prazo: {dateTimeFmt(card.deadline_at)}</p>
        ) : null}
      </PortalCard>

      <div className="grid grid-cols-2 gap-3">
        <PortalTile>
          <div className="p-4">
            <PortalLabel>Planejado</PortalLabel>
            <p className="display-type mt-1 text-xl">{minutesToHours(card.planned_minutes)}</p>
          </div>
        </PortalTile>
        <PortalTile>
          <div className="p-4">
            <PortalLabel>Trabalhado</PortalLabel>
            <p className="display-type mt-1 text-xl">{minutesToHours(card.worked_minutes)}</p>
          </div>
        </PortalTile>
        <PortalTile>
          <div className="p-4">
            <PortalLabel>Extras</PortalLabel>
            <p className="display-type mt-1 text-xl">{minutesToHours(card.overtime_minutes)}</p>
          </div>
        </PortalTile>
        <PortalTile>
          <div className="p-4">
            <PortalLabel>Saldo</PortalLabel>
            <p className="display-type mt-1 text-xl">{minutesToHours(card.balance_minutes)}</p>
          </div>
        </PortalTile>
      </div>

      {step === "conferencia" ? (
        <>
          <PortalCard className="p-5">
            <PortalLabel>Grade diária</PortalLabel>
            <ul className="mt-3 space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="rounded-[16px] border-2 border-foreground bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{dateFmt(e.work_date)}</span>
                    <span className="text-xs text-muted-foreground">{minutesToHours(e.worked_minutes)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.clock_in ? new Date(e.clock_in).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    {" → "}
                    {e.clock_out ? new Date(e.clock_out).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                  {(e.alerts ?? []).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(e.alerts ?? []).map((a: string) => (
                        <PortalChip key={a} tone="warn">
                          {ALERT_LABEL[a] ?? a}
                        </PortalChip>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </PortalCard>

          {disputes.length > 0 ? (
            <PortalCard className="p-5">
              <PortalLabel>Minhas divergências</PortalLabel>
              <ul className="mt-3 space-y-2 text-sm">
                {disputes.map((d) => (
                  <li key={d.id} className="rounded-[16px] border-2 border-foreground bg-background p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <PortalChip tone={d.status === "resolvida" ? "acid" : "warn"}>
                        {DISPUTE_STATUS_LABEL[d.status] ?? d.status}
                      </PortalChip>
                      <PortalChip>{DISPUTE_CATEGORY_LABEL[d.category] ?? d.category}</PortalChip>
                    </div>
                    <p className="mt-2">{d.description}</p>
                    {d.manager_response ? (
                      <p className="mt-2 text-xs text-muted-foreground">Resposta: {d.manager_response}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </PortalCard>
          ) : null}

          {canSign ? (
            <div className="space-y-3">
              <PortalButton block onClick={() => void startSign()}>
                Está correto — assinar
              </PortalButton>
              <PortalButton block variant="secondary" onClick={() => setDisputeOpen((v) => !v)}>
                Apontar divergência
              </PortalButton>
            </div>
          ) : null}

          {disputeOpen ? (
            <PortalCard className="space-y-3 p-5">
              <PortalLabel>Nova divergência</PortalLabel>
              <PortalField label="Tipo">
                <select
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
              <PortalField label="Dia (opcional)">
                <input
                  type="date"
                  className={portalInputClass}
                  value={disputeDate}
                  onChange={(e) => setDisputeDate(e.target.value)}
                />
              </PortalField>
              <PortalField label="O que está diferente?">
                <textarea
                  className={portalInputClass}
                  rows={4}
                  value={disputeText}
                  onChange={(e) => setDisputeText(e.target.value)}
                  placeholder="Descreva o que precisa ser revisto."
                />
              </PortalField>
              <PortalButton
                block
                onClick={() => dispute.mutate()}
                loading={dispute.isPending}
                disabled={disputeText.trim().length < 5}
              >
                Enviar divergência
              </PortalButton>
            </PortalCard>
          ) : null}
        </>
      ) : null}

      {step === "identidade" ? (
        <PortalCard className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5" aria-hidden />
            <PortalLabel>Validação de identidade</PortalLabel>
          </div>
          <p className="text-sm text-muted-foreground">
            Tire uma selfie para confirmar que é você. A imagem não é armazenada — guardamos apenas o
            resultado da validação.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-4" aria-hidden />
            Localização: {geo.locationStatus}
            {geo.accuracy ? ` (±${Math.round(geo.accuracy)} m)` : ""}
          </div>
          <SelfieCapture value={selfie} onChange={setSelfie} />
          <PortalButton block onClick={() => validate.mutate()} loading={validate.isPending} disabled={!selfie}>
            Validar identidade
          </PortalButton>
          <PortalButton
            block
            variant="secondary"
            onClick={() => {
              setFaceSkipReason("Sem câmera disponível no dispositivo.");
              setStep("assinatura");
            }}
          >
            Não consigo usar a câmera
          </PortalButton>
        </PortalCard>
      ) : null}

      {step === "assinatura" ? (
        <PortalCard className="space-y-4 p-5">
          <PortalLabel>Assinatura</PortalLabel>
          <p className="text-sm">{TIMESHEET_TERM}</p>
          <p className="text-xs text-muted-foreground">{TIMESHEET_DISCLAIMER}</p>

          <div className="flex gap-2">
            <PortalButton
              variant={signatureMode === "desenhada" ? "primary" : "secondary"}
              onClick={() => setSignatureMode("desenhada")}
            >
              Desenhar
            </PortalButton>
            <PortalButton
              variant={signatureMode === "digitada" ? "primary" : "secondary"}
              onClick={() => setSignatureMode("digitada")}
            >
              Digitar nome
            </PortalButton>
          </div>

          {signatureMode === "desenhada" ? (
            <SignaturePad value={signature} onChange={setSignature} />
          ) : (
            <PortalField label="Nome completo">
              <input
                className={portalInputClass}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Digite seu nome completo"
              />
            </PortalField>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[var(--acid)]"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            Li e concordo com o termo de conferência do cartão de ponto.
          </label>

          <PortalButton
            block
            onClick={() => sign.mutate()}
            loading={sign.isPending}
            disabled={!agreed || (signatureMode === "desenhada" ? !signature : typedName.trim().length < 3)}
          >
            Assinar cartão
          </PortalButton>
          <PortalButton block variant="secondary" onClick={() => setStep("conferencia")}>
            Voltar à conferência
          </PortalButton>
        </PortalCard>
      ) : null}
    </div>
  );
}

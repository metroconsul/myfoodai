import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { portalPunch, portalTimeEntries, portalRequestCorrection } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateTimeFmt, isoDate, addDays, dateFmt } from "@/lib/format";
import {
  PortalButton,
  PortalCard,
  PortalChip,
  PortalEmpty,
  PortalField,
  PortalLabel,
  PortalSection,
  PortalTile,
} from "@/components/portal-ui";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "entrada", label: "Entrada" },
  { value: "intervalo_saida", label: "Início do intervalo" },
  { value: "intervalo_retorno", label: "Retorno do intervalo" },
  { value: "saida", label: "Saída" },
] as const;

type EntryType = (typeof TYPES)[number]["value"];

export const Route = createFileRoute("/portal/ponto")({
  head: () => ({
    meta: [
      { title: `Registrar ponto — ${BRAND_NAME}` },
      { name: "description", content: "Registre entrada, intervalo e saída com localização auditável." },
      { property: "og:title", content: `Registrar ponto — ${BRAND_NAME}` },
      { property: "og:description", content: "Batida de ponto com geolocalização." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPunchPage,
});

function getPosition(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    ),
  );
}

function PortalPunchPage() {
  const { token, ready } = usePortalSession();
  const punch = useServerFn(portalPunch);
  const listEntries = useServerFn(portalTimeEntries);
  const requestCorrection = useServerFn(portalRequestCorrection);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<EntryType>("entrada");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ type: EntryType; coords: GeolocationCoordinates | null } | null>(null);
  const [correctionFor, setCorrectionFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (ready && !token) navigate({ to: "/portal/login", replace: true });
  }, [ready, token, navigate]);

  const from = isoDate(addDays(new Date(), -7));
  const to = isoDate(new Date());

  const { data } = useQuery({
    queryKey: ["portal-entries", token, from, to],
    enabled: !!token,
    queryFn: () => listEntries({ data: { token: token!, from, to } }),
  });

  const entries = data && !("error" in data) ? data.entries : [];
  const last = entries[0] ?? null;
  const journeyStatus = !last
    ? "Pronto para registrar"
    : last.entry_type === "saida"
      ? "Jornada concluída"
      : last.entry_type === "intervalo_saida"
        ? "Pausa em andamento"
        : "Entrada registrada";

  async function startPunch(type: EntryType) {
    setBusy(true);
    const pos = await getPosition();
    setBusy(false);
    setConfirm({ type, coords: pos?.coords ?? null });
  }

  async function confirmPunch() {
    if (!confirm || !token) return;
    setBusy(true);
    try {
      const result = await punch({
        data: {
          token,
          entryType: confirm.type,
          latitude: confirm.coords?.latitude ?? null,
          longitude: confirm.coords?.longitude ?? null,
          accuracy: confirm.coords?.accuracy ?? null,
          deviceTime: new Date().toISOString(),
          userAgent: navigator.userAgent.slice(0, 400),
        },
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Registro realizado.");
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["portal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["portal-me"] });
    } catch {
      toast.error("Não foi possível concluir agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCorrection() {
    if (!token) return;
    const result = await requestCorrection({
      data: { token, timeEntryId: correctionFor, reason: reason.trim() },
    });
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Solicitação enviada para revisão.");
    setCorrectionFor(null);
    setReason("");
  }

  return (
    <div className="space-y-6">
      <PortalCard className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <PortalLabel>Meu ponto</PortalLabel>
            <p className="display-type mt-1 text-xl">{dateFmt(to)}</p>
          </div>
          <PortalChip tone={journeyStatus === "Jornada concluída" ? "acid" : "card"}>{journeyStatus}</PortalChip>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={selected === t.value}
              onClick={() => setSelected(t.value)}
              className={cn(
                "portal-press min-h-14 rounded-[16px] border-2 border-foreground px-3 text-sm font-bold shadow-[2px_2px_0_var(--ink)]",
                selected === t.value ? "bg-accent text-accent-foreground" : "bg-card",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <PortalButton block className="mt-4" loading={busy} onClick={() => startPunch(selected)}>
          {busy ? "Obtendo localização…" : `Registrar ${TYPES.find((t) => t.value === selected)!.label.toLowerCase()}`}
        </PortalButton>

        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          Seu registro pode usar a localização para confirmar se você está dentro do raio permitido da unidade.
        </p>
      </PortalCard>

      <PortalSection title="Últimos 7 dias">
        {entries.length === 0 ? (
          <PortalEmpty title="Nenhuma informação disponível para este período." />
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li key={e.id}>
                <PortalTile className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold capitalize">{e.entry_type.replaceAll("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">{dateTimeFmt(e.server_time)}</p>
                    <button
                      type="button"
                      className="mt-1 text-xs font-bold underline underline-offset-4"
                      onClick={() => setCorrectionFor(e.id)}
                    >
                      Solicitar ajuste
                    </button>
                  </div>
                  <PortalChip tone={e.geo_status === "dentro_do_raio" ? "acid" : "warn"}>
                    {e.geo_status.replaceAll("_", " ")}
                  </PortalChip>
                </PortalTile>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Confirmar registro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-bold">{TYPES.find((t) => t.value === confirm?.type)?.label}</span> em{" "}
              {new Date().toLocaleString("pt-BR")}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4" aria-hidden />
              {confirm?.coords
                ? `Localização capturada (precisão ${Math.round(confirm.coords.accuracy)} m)`
                : "Localização indisponível — a batida poderá ir para revisão."}
            </p>
            <PortalButton block loading={busy} onClick={confirmPunch}>
              Confirmar
            </PortalButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!correctionFor} onOpenChange={(o) => !o && setCorrectionFor(null)}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Solicitar ajuste</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCorrection();
            }}
          >
            <PortalField id="reason" label="Motivo" hint="Conte o que aconteceu com esta batida.">
              <Textarea
                id="reason"
                required
                minLength={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explique o que aconteceu com esta batida."
                className="rounded-[16px]"
              />
            </PortalField>
            <div className="flex gap-2">
              <PortalButton
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setCorrectionFor(null)}
              >
                Cancelar
              </PortalButton>
              <PortalButton type="submit" className="flex-1">
                Enviar
              </PortalButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

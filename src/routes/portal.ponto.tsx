import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { portalPunch, portalTimeEntries, portalRequestCorrection } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateTimeFmt, isoDate, addDays } from "@/lib/format";
import { EmptyState, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

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
      toast.success("Ponto registrado.");
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["portal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["portal-me"] });
    } catch {
      toast.error("Não foi possível registrar agora.");
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
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Registrar ponto</h1>
      <p className="text-sm text-muted-foreground">
        Sua localização é usada apenas para validar a batida na unidade e fica registrada na auditoria.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {TYPES.map((t) => (
          <Button
            key={t.value}
            variant={selected === t.value ? "default" : "outline"}
            onClick={() => setSelected(t.value)}
            className="h-14"
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Button className="h-12 w-full" disabled={busy} onClick={() => startPunch(selected)}>
        {busy ? "Obtendo localização…" : `Bater ${TYPES.find((t) => t.value === selected)!.label.toLowerCase()}`}
      </Button>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Últimos 7 dias
        </h2>
        {entries.length === 0 ? (
          <EmptyState title="Nenhum registro no período" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{e.entry_type.replaceAll("_", " ")}</span>
                  <span className="text-xs text-muted-foreground">{dateTimeFmt(e.server_time)}</span>
                  <button
                    type="button"
                    className="mt-1 block text-xs text-primary underline"
                    onClick={() => setCorrectionFor(e.id)}
                  >
                    Solicitar correção
                  </button>
                </span>
                <StatusBadge tone={e.geo_status === "dentro_do_raio" ? "ok" : "warn"}>
                  {e.geo_status.replaceAll("_", " ")}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar registro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-medium">
                {TYPES.find((t) => t.value === confirm?.type)?.label}
              </span>{" "}
              em {new Date().toLocaleString("pt-BR")}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4" aria-hidden />
              {confirm?.coords
                ? `Localização capturada (precisão ${Math.round(confirm.coords.accuracy)} m)`
                : "Localização indisponível — a batida poderá ir para revisão."}
            </p>
            <Button className="w-full" disabled={busy} onClick={confirmPunch}>
              {busy ? "Registrando…" : "Confirmar batida"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!correctionFor} onOpenChange={(o) => !o && setCorrectionFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar correção</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCorrection();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea
                id="reason"
                required
                minLength={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explique o que aconteceu com esta batida."
              />
            </div>
            <Button type="submit" className="w-full">
              Enviar solicitação
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

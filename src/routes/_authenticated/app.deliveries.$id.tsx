import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Printer, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { cancelDelivery } from "@/lib/deliveries.functions";
import { PageHeader, SectionCard, StatusBadge, LoadingState, ErrorState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { dateTimeFmt, numberFmt } from "@/lib/format";
import {
  FACE_STATUS_LABEL,
  LOCATION_STATUS_LABEL,
  REASON_LABEL,
  RECEIPT_TERMS,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/items.shared";

export const Route = createFileRoute("/_authenticated/app/deliveries/$id")({
  head: () => ({
    meta: [
      { title: `Comprovante de entrega — ${BRAND_NAME}` },
      { name: "description", content: "Comprovante auditável da entrega de itens, com evidências do aceite." },
      { property: "og:title", content: `Comprovante de entrega — ${BRAND_NAME}` },
      { property: "og:description", content: "Evidências, assinatura e trilha de auditoria da entrega." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeliveryDetailPage,
});

const EVENT_LABEL: Record<string, string> = {
  entrega_criada: "Entrega criada",
  publicada_no_portal: "Publicada no portal",
  entrega_visualizada: "Visualizada pelo colaborador",
  validacao_identidade: "Validação de identidade",
  entrega_assinada: "Assinada pelo colaborador",
  entrega_recusada: "Recusada pelo colaborador",
  divergencia_registrada: "Divergência registrada",
  entrega_cancelada: "Entrega cancelada",
};

function DeliveryDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelDelivery);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const detail = useQuery({
    queryKey: ["item-delivery", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_deliveries")
        .select(
          "*, employees(full_name, employee_code, cpf, roles(name)), units(name), item_delivery_items(*), item_delivery_evidence(*)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["item-delivery-events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_delivery_events")
        .select("id, event_type, actor_type, actor_label, metadata, created_at")
        .eq("delivery_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const delivery = detail.data;
  const evidence = delivery?.item_delivery_evidence ?? null;
  const signatureUrl = useSignedUrl("signatures", evidence?.signature_path);
  const selfieUrl = useSignedUrl("signatures", evidence?.face_asset_path);

  const cancel = useMutation({
    mutationFn: async () => {
      const res = await cancelFn({ data: { deliveryId: id, reason: cancelReason.trim(), restoreStock: true } });
      if ("error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Entrega cancelada e estoque estornado.");
      setCancelOpen(false);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["item-delivery", id] });
      queryClient.invalidateQueries({ queryKey: ["item-delivery-events", id] });
      queryClient.invalidateQueries({ queryKey: ["item-deliveries"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao cancelar."),
  });

  if (detail.isLoading) return <LoadingState rows={6} label="Carregando comprovante…" />;
  if (detail.isError || !delivery) {
    return (
      <ErrorState
        title="Entrega não encontrada"
        description="Ela pode ter sido removida ou pertence a outra unidade."
        action={<Button onClick={() => navigate({ to: "/app/deliveries" })}>Voltar para entregas</Button>}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Comprovante de entrega"
        title={delivery.employees?.full_name ?? "Colaborador"}
        description={`${REASON_LABEL[delivery.reason] ?? delivery.reason} · ${delivery.units?.name ?? ""} · entregue em ${dateTimeFmt(delivery.delivered_at)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/deliveries">
                <ArrowLeft className="size-4" aria-hidden />
                Voltar
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Imprimir
            </Button>
            {delivery.status !== "cancelado" && delivery.status !== "assinado" ? (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                Cancelar entrega
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <SectionCard
            title="Situação"
            action={
              <StatusBadge tone={STATUS_TONE[delivery.status] ?? "neutral"}>
                {STATUS_LABEL[delivery.status] ?? delivery.status}
              </StatusBadge>
            }
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="meta-mono">Responsável pela entrega</dt>
                <dd className="font-medium">{delivery.responsible_label ?? "—"}</dd>
              </div>
              <div>
                <dt className="meta-mono">Matrícula</dt>
                <dd className="font-medium">{delivery.employees?.employee_code ?? "—"}</dd>
              </div>
              <div>
                <dt className="meta-mono">Função</dt>
                <dd className="font-medium">{delivery.employees?.roles?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="meta-mono">Aceite</dt>
                <dd className="font-medium">{dateTimeFmt(delivery.accepted_at)}</dd>
              </div>
              {delivery.refusal_reason ? (
                <div className="sm:col-span-2">
                  <dt className="meta-mono">Motivo da recusa</dt>
                  <dd className="font-medium">{delivery.refusal_reason}</dd>
                </div>
              ) : null}
              {delivery.divergence_notes ? (
                <div className="sm:col-span-2">
                  <dt className="meta-mono">Divergência relatada</dt>
                  <dd className="font-medium">{delivery.divergence_notes}</dd>
                </div>
              ) : null}
              {delivery.notes ? (
                <div className="sm:col-span-2">
                  <dt className="meta-mono">Observações</dt>
                  <dd className="font-medium">{delivery.notes}</dd>
                </div>
              ) : null}
            </dl>
          </SectionCard>

          <SectionCard title="Itens entregues">
            <ul className="space-y-2">
              {(delivery.item_delivery_items ?? []).map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border-2 border-foreground bg-secondary p-3"
                >
                  <span className="font-bold">{item.item_name}</span>
                  <span className="text-sm text-muted-foreground">
                    {numberFmt(Number(item.quantity))}
                    {item.size ? ` · tam. ${item.size}` : ""}
                    {item.color ? ` · ${item.color}` : ""}
                    {item.lot ? ` · lote ${item.lot}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Termo aceito pelo colaborador">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {RECEIPT_TERMS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {evidence?.terms_version ? (
              <p className="meta-mono mt-3">Versão do termo: {evidence.terms_version}</p>
            ) : null}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Evidências do aceite">
            {evidence ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={evidence.face_status === "aprovado" ? "ok" : "warn"}>
                    <ShieldCheck className="mr-1 size-3" aria-hidden />
                    {FACE_STATUS_LABEL[evidence.face_status] ?? evidence.face_status}
                  </StatusBadge>
                  <StatusBadge tone={evidence.location_status === "obtida" ? "ok" : "neutral"}>
                    {LOCATION_STATUS_LABEL[evidence.location_status] ?? evidence.location_status}
                  </StatusBadge>
                </div>
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="meta-mono">Provedor de identidade</dt>
                    <dd>{evidence.face_provider ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="meta-mono">Prova de vida</dt>
                    <dd>{evidence.liveness_status ?? "não avaliada"}</dd>
                  </div>
                  <div>
                    <dt className="meta-mono">Localização</dt>
                    <dd>
                      {evidence.latitude != null && evidence.longitude != null
                        ? `${Number(evidence.latitude).toFixed(5)}, ${Number(evidence.longitude).toFixed(5)} (±${numberFmt(Number(evidence.accuracy_meters ?? 0), 0)} m)`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta-mono">Assinatura</dt>
                    <dd>
                      {evidence.signature_type === "digitada"
                        ? `Digitada: ${evidence.signature_typed_name ?? "—"}`
                        : evidence.signature_type === "desenhada"
                          ? "Desenhada em tela"
                          : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="meta-mono">Hash de integridade</dt>
                    <dd className="break-all text-xs">{evidence.integrity_hash ?? "—"}</dd>
                  </div>
                </dl>
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Assinatura registrada pelo colaborador"
                    className="w-full rounded-[12px] border-2 border-foreground bg-card"
                  />
                ) : null}
                {selfieUrl ? (
                  <img
                    src={selfieUrl}
                    alt="Selfie registrada na validação de identidade"
                    className="w-40 rounded-[12px] border-2 border-foreground"
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma evidência registrada ainda. O colaborador ainda não iniciou o aceite no portal.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Trilha de auditoria">
            {events.isLoading ? (
              <LoadingState rows={3} />
            ) : (
              <ol className="space-y-3">
                {(events.data ?? []).map((event) => (
                  <li key={event.id} className="border-l-2 border-foreground pl-3">
                    <p className="text-sm font-bold">{EVENT_LABEL[event.event_type] ?? event.event_type}</p>
                    <p className="meta-mono">
                      {dateTimeFmt(event.created_at)} · {event.actor_label ?? event.actor_type}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar entrega</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              cancel.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Motivo do cancelamento</Label>
              <Textarea
                id="cancel-reason"
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O histórico é preservado e o estoque da unidade é estornado automaticamente.
            </p>
            <Button type="submit" variant="destructive" className="w-full" disabled={cancel.isPending}>
              {cancel.isPending ? "Cancelando…" : "Confirmar cancelamento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

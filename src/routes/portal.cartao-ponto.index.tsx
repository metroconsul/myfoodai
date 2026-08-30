import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { portalPointCards, portalAcknowledgePointCard } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateFmt, dateTimeFmt, minutesToHours } from "@/lib/format";
import {
  PortalButton,
  PortalCard,
  PortalChip,
  PortalEmpty,
  PortalLabel,
  PortalLoading,
} from "@/components/portal-ui";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/cartao-ponto")({
  head: () => ({
    meta: [
      { title: `Meu cartão de ponto — ${BRAND_NAME}` },
      { name: "description", content: "Consulte e confirme ciência do seu cartão de ponto por período." },
      { property: "og:title", content: `Meu cartão de ponto — ${BRAND_NAME}` },
      { property: "og:description", content: "Cartão de ponto do colaborador com horas e pendências." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPointCardPage,
});

function PortalPointCardPage() {
  const { token, ready } = usePortalSession();
  const listCards = useServerFn(portalPointCards);
  const acknowledge = useServerFn(portalAcknowledgePointCard);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (ready && !token) navigate({ to: "/portal/login", replace: true });
  }, [ready, token, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-cards", token],
    enabled: !!token,
    queryFn: () => listCards({ data: { token: token! } }),
  });

  const cards = data && !("error" in data) ? data.cards : [];

  async function confirm(id: string) {
    if (!token) return;
    const result = await acknowledge({ data: { token, pointCardId: id } });
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Ciência registrada.");
    queryClient.invalidateQueries({ queryKey: ["portal-cards"] });
  }

  return (
    <div className="space-y-5">
      <PortalCard className="p-6">
        <PortalLabel>Avisos e cartão de ponto</PortalLabel>
        <h1 className="display-type mt-1 text-2xl">Meu cartão de ponto</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cada período traz horas planejadas, trabalhadas e pendências. Ao confirmar, sua ciência fica
          registrada com data e hora.
        </p>
      </PortalCard>

      {isLoading ? (
        <PortalLoading />
      ) : cards.length === 0 ? (
        <PortalEmpty
          title="Nenhuma informação disponível para este período."
          description="Sua liderança gera o cartão ao fechar cada período."
        />
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => (
            <li key={c.id} className="portal-tile p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">
                  {dateFmt(c.period_start)} — {dateFmt(c.period_end)}
                </span>
                <PortalChip tone={c.acknowledged_at ? "acid" : "warn"}>
                  {c.acknowledged_at ? "Ciente" : c.status}
                </PortalChip>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-[12px] border-2 border-foreground bg-background p-3">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Planejado
                  </dt>
                  <dd className="display-type mt-1 text-lg">{minutesToHours(c.planned_minutes)}</dd>
                </div>
                <div className="rounded-[12px] border-2 border-foreground bg-background p-3">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Trabalhado
                  </dt>
                  <dd className="display-type mt-1 text-lg">{minutesToHours(c.worked_minutes)}</dd>
                </div>
                <div className="rounded-[12px] border-2 border-foreground bg-background p-3">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Atrasos
                  </dt>
                  <dd className="display-type mt-1 text-lg">{minutesToHours(c.late_minutes)}</dd>
                </div>
                <div className="rounded-[12px] border-2 border-foreground bg-background p-3">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Batidas faltantes
                  </dt>
                  <dd className="display-type mt-1 text-lg">{c.missing_punches}</dd>
                </div>
              </dl>
              {c.acknowledged_at ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Ciência em {dateTimeFmt(c.acknowledged_at)}
                </p>
              ) : (
                <PortalButton block className="mt-4" onClick={() => void confirm(c.id)}>
                  Confirmar
                </PortalButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { portalPointCards, portalAcknowledgePointCard } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateFmt, dateTimeFmt, minutesToHours } from "@/lib/format";
import { EmptyState, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Meu cartão de ponto</h1>
      <p className="text-sm text-muted-foreground">
        Cada período traz horas planejadas, trabalhadas e pendências. Ao confirmar, sua ciência fica registrada
        com data e hora.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : cards.length === 0 ? (
        <EmptyState
          title="Nenhum cartão disponível"
          description="Sua liderança gera o cartão ao fechar cada período."
        />
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => (
            <li key={c.id} className="rounded-[12px] border-2 border-foreground bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {dateFmt(c.period_start)} — {dateFmt(c.period_end)}
                </span>
                <StatusBadge tone={c.acknowledged_at ? "ok" : "warn"}>
                  {c.acknowledged_at ? "Ciente" : c.status}
                </StatusBadge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Planejado</dt>
                  <dd className="font-medium">{minutesToHours(c.planned_minutes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Trabalhado</dt>
                  <dd className="font-medium">{minutesToHours(c.worked_minutes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Atrasos</dt>
                  <dd className="font-medium">{minutesToHours(c.late_minutes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Batidas faltantes</dt>
                  <dd className="font-medium">{c.missing_punches}</dd>
                </div>
              </dl>
              {c.acknowledged_at ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Ciência em {dateTimeFmt(c.acknowledged_at)}
                </p>
              ) : (
                <Button className="mt-3 w-full" onClick={() => void confirm(c.id)}>
                  Confirmar ciência
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

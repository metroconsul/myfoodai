import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { portalMyTimesheets } from "@/lib/portal-timesheet.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateFmt, minutesToHours } from "@/lib/format";
import { CARD_STATUS_LABEL, CARD_STATUS_MESSAGE, monthLabel } from "@/lib/timesheet.shared";
import {
  PortalButton,
  PortalCard,
  PortalChip,
  PortalEmpty,
  PortalLabel,
  PortalLoading,
} from "@/components/portal-ui";

export const Route = createFileRoute("/portal/cartao-ponto/")({
  head: () => ({
    meta: [
      { title: `Meu cartão de ponto — ${BRAND_NAME}` },
      { name: "description", content: "Consulte, conteste e assine seu cartão de ponto por período." },
      { property: "og:title", content: `Meu cartão de ponto — ${BRAND_NAME}` },
      { property: "og:description", content: "Cartão de ponto do colaborador com horas, pendências e assinatura." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPointCardsPage,
});

const TABS = [
  { key: "pendentes", label: "Pendentes" },
  { key: "assinados", label: "Assinados" },
  { key: "divergencia", label: "Divergência" },
  { key: "arquivados", label: "Arquivados" },
] as const;

const OPEN = ["publicado", "em_validacao", "corrigido", "reaberto"];

function PortalPointCardsPage() {
  const { token, ready } = usePortalSession();
  const listCards = useServerFn(portalMyTimesheets);
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pendentes");

  useEffect(() => {
    if (ready && !token) void navigate({ to: "/portal/login", replace: true });
  }, [ready, token, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-cards", token],
    enabled: !!token,
    queryFn: () => listCards({ data: { token: token! } }),
  });

  const cards = data && !("error" in data) ? data.cards : [];

  const filtered = useMemo(() => {
    if (tab === "pendentes") return cards.filter((c) => OPEN.includes(c.status));
    if (tab === "assinados") return cards.filter((c) => c.status === "assinado");
    if (tab === "divergencia") return cards.filter((c) => c.status === "divergente");
    return cards.filter((c) => ["expirado", "erro_publicacao"].includes(c.status));
  }, [cards, tab]);

  return (
    <div className="space-y-5">
      <PortalCard className="p-6">
        <PortalLabel>Cartão de ponto</PortalLabel>
        <h1 className="display-type mt-1 text-2xl">Meus cartões de ponto</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cada período traz horas planejadas, trabalhadas e pendências. Confira, aponte divergências e
          assine quando estiver de acordo.
        </p>
      </PortalCard>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtros de cartões">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`portal-press shrink-0 rounded-full border-2 border-foreground px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] ${
              tab === t.key ? "bg-accent text-accent-foreground" : "bg-card text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PortalLoading />
      ) : filtered.length === 0 ? (
        <PortalEmpty
          title="Nenhum cartão nesta aba."
          description="Sua liderança publica o cartão ao fechar cada período."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id} className="portal-tile p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold capitalize">{monthLabel(c.period_start)}</span>
                <PortalChip tone={c.status === "assinado" ? "acid" : c.status === "divergente" ? "danger" : "warn"}>
                  {CARD_STATUS_LABEL[c.status] ?? c.status}
                </PortalChip>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {dateFmt(c.period_start)} — {dateFmt(c.period_end)}
              </p>
              <p className="mt-2 text-sm">{CARD_STATUS_MESSAGE[c.status] ?? ""}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-[12px] border-2 border-foreground bg-background p-3">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Trabalhado
                  </dt>
                  <dd className="display-type mt-1 text-lg">{minutesToHours(c.worked_minutes)}</dd>
                </div>
                <div className="rounded-[12px] border-2 border-foreground bg-background p-3">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Saldo
                  </dt>
                  <dd className="display-type mt-1 text-lg">{minutesToHours(c.balance_minutes)}</dd>
                </div>
              </dl>
              <PortalButton
                block
                className="mt-4"
                variant={OPEN.includes(c.status) ? "primary" : "secondary"}
                onClick={() => void navigate({ to: "/portal/cartao-ponto/$id", params: { id: c.id } })}
              >
                {OPEN.includes(c.status) ? "Conferir e assinar" : "Ver detalhes"}
              </PortalButton>
            </li>
          ))}
        </ul>
      )}

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/portal" className="underline">
          Voltar para o início
        </Link>
      </p>
    </div>
  );
}

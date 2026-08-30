import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, PackageCheck } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import { usePortalSession } from "@/hooks/use-portal-session";
import { portalMyItems } from "@/lib/portal-items.functions";
import {
  PortalCard,
  PortalChip,
  PortalEmpty,
  PortalError,
  PortalIconBox,
  PortalLabel,
  PortalLoading,
  PortalSection,
} from "@/components/portal-ui";
import { dateFmt, numberFmt } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/items.shared";

export const Route = createFileRoute("/portal/itens/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Meus itens — ${BRAND_NAME}` },
      { name: "description", content: "Consulte e confirme o recebimento dos seus itens de trabalho." },
      { property: "og:title", content: `Meus itens — ${BRAND_NAME}` },
      { property: "og:description", content: "Itens recebidos e pendências de aceite." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalItemsPage,
});

const CHIP_TONE: Record<string, "acid" | "warn" | "info" | "danger" | "card"> = {
  aguardando_aceite: "warn",
  em_validacao: "info",
  assinado: "acid",
  recusado: "danger",
  divergente: "danger",
  cancelado: "card",
  expirado: "card",
};

function PortalItemsPage() {
  const { token } = usePortalSession();
  const fetchItems = useServerFn(portalMyItems);

  const query = useQuery({
    queryKey: ["portal-my-items", token],
    enabled: !!token,
    queryFn: () => fetchItems({ data: { token: token! } }),
  });

  if (query.isLoading) return <PortalLoading label="Carregando seus itens…" />;
  if (query.isError || (query.data && "error" in query.data)) {
    return (
      <PortalError
        title="Não foi possível carregar seus itens"
        description="Verifique sua conexão e tente novamente."
      />
    );
  }

  const data = query.data && !("error" in query.data) ? query.data : null;
  const deliveries = data?.deliveries ?? [];
  const pending = deliveries.filter((d) => d.status === "aguardando_aceite" || d.status === "em_validacao");
  const history = deliveries.filter((d) => !pending.includes(d));

  return (
    <div className="space-y-6">
      <PortalCard>
        <div className="flex items-center gap-3">
          <PortalIconBox>
            <PackageCheck className="size-5" aria-hidden />
          </PortalIconBox>
          <div>
            <PortalLabel>Meus itens</PortalLabel>
            <p className="display-type text-xl">
              {pending.length > 0 ? `${pending.length} aguardando você` : "Tudo confirmado"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Confirme o recebimento dos uniformes e materiais entregues pela sua unidade.
        </p>
      </PortalCard>

      {pending.length > 0 ? (
        <PortalSection title="Pendentes de aceite">
          <ul className="space-y-3">
            {pending.map((d) => (
              <li key={d.id}>
                <Link
                  to="/portal/itens/$id"
                  params={{ id: d.id }}
                  className="portal-press flex items-center gap-3 rounded-[24px] border-2 border-foreground bg-accent p-4 text-accent-foreground shadow-[4px_4px_0_var(--ink)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="display-type text-base">
                      {(d.item_delivery_items ?? []).length} item(ns) para confirmar
                    </p>
                    <p className="mt-1 truncate text-xs font-medium">
                      {(d.item_delivery_items ?? []).map((i) => i.item_name).join(" · ")}
                    </p>
                    <p className="mt-1 text-xs">Entregue em {dateFmt(d.delivered_at)}</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </PortalSection>
      ) : null}

      <PortalSection title="Histórico">
        {history.length === 0 ? (
          <PortalEmpty
            title="Nenhum item registrado ainda"
            description="Quando você receber uniformes ou materiais, eles aparecem aqui."
          />
        ) : (
          <ul className="space-y-3">
            {history.map((d) => (
              <li key={d.id}>
                <Link
                  to="/portal/itens/$id"
                  params={{ id: d.id }}
                  className="portal-press flex items-center gap-3 rounded-[24px] border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_var(--ink)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {(d.item_delivery_items ?? [])
                        .map((i) => `${i.item_name} x${numberFmt(Number(i.quantity), 0)}`)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{dateFmt(d.delivered_at)}</p>
                  </div>
                  <PortalChip tone={CHIP_TONE[d.status] ?? "card"}>{STATUS_LABEL[d.status] ?? d.status}</PortalChip>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>
    </div>
  );
}

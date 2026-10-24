import { createFileRoute } from "@tanstack/react-router";
import { BRAND_NAME } from "@/config/brand";
import { SalesPage } from "@/apps/caixa-financeiro/pages/sales-page";

export const Route = createFileRoute("/_authenticated/app/sales")({
  head: () => ({
    meta: [
      { title: `Vendas — ${BRAND_NAME}` },
      { name: "description", content: "Indicadores de vendas por unidade e conexões de integração com o PDV." },
      { property: "og:title", content: `Vendas — ${BRAND_NAME}` },
      { property: "og:description", content: "Painel de vendas com adapters de API, webhook e CSV." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SalesPage,
});

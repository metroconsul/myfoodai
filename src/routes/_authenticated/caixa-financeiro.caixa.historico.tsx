import { createFileRoute } from "@tanstack/react-router";
import { CaixaHistoryPage } from "@/apps/caixa-financeiro/pages/caixa-pages";

export const Route = createFileRoute("/_authenticated/caixa-financeiro/caixa/historico")({
  component: CaixaHistoryPage,
});

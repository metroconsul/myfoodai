import { createFileRoute } from "@tanstack/react-router";
import { CaixaListPage } from "@/apps/caixa-financeiro/pages/caixa-pages";

export const Route = createFileRoute("/_authenticated/caixa-financeiro/caixa/")({
  component: CaixaListPage,
});

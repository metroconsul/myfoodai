import { createFileRoute } from "@tanstack/react-router";
import { HistoricoPage } from "@/apps/compras/pages/historico-page";

export const Route = createFileRoute("/_authenticated/compras/historico")({
  component: HistoricoPage,
});

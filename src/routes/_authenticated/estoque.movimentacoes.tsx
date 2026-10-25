import { createFileRoute } from "@tanstack/react-router";
import { MovimentacoesPage } from "@/apps/estoque/pages/movimentacoes-page";

export const Route = createFileRoute("/_authenticated/estoque/movimentacoes")({
  component: MovimentacoesPage,
});

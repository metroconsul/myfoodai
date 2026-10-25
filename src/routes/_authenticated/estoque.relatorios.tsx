import { createFileRoute } from "@tanstack/react-router";
import { RelatoriosPage } from "@/apps/estoque/pages/relatorios-page";

export const Route = createFileRoute("/_authenticated/estoque/relatorios")({
  component: RelatoriosPage,
});

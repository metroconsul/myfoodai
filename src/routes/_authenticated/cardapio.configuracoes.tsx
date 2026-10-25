import { createFileRoute } from "@tanstack/react-router";
import { CardapioConfigPage } from "@/apps/cardapio/pages/config-page";

export const Route = createFileRoute("/_authenticated/cardapio/configuracoes")({
  component: CardapioConfigPage,
});

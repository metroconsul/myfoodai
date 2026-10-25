import { createFileRoute } from "@tanstack/react-router";
import { ItensPage } from "@/apps/cardapio/pages/itens-page";

export const Route = createFileRoute("/_authenticated/cardapio/itens")({
  component: ItensPage,
});

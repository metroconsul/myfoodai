import { createFileRoute } from "@tanstack/react-router";
import { DivulgarPage } from "@/apps/cardapio/pages/divulgar-page";

export const Route = createFileRoute("/_authenticated/cardapio/divulgar")({
  component: DivulgarPage,
});

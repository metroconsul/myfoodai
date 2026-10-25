import { createFileRoute } from "@tanstack/react-router";
import { MesasPage } from "@/apps/cardapio/pages/mesas-page";

export const Route = createFileRoute("/_authenticated/cardapio/mesas")({
  component: MesasPage,
});

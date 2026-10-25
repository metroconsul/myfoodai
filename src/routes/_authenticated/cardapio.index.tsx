import { createFileRoute } from "@tanstack/react-router";
import { PedidosPage } from "@/apps/cardapio/pages/pedidos-page";

export const Route = createFileRoute("/_authenticated/cardapio/")({
  component: PedidosPage,
});

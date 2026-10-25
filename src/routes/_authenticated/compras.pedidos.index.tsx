import { createFileRoute } from "@tanstack/react-router";
import { PedidosPage } from "@/apps/compras/pages/pedidos-page";

export const Route = createFileRoute("/_authenticated/compras/pedidos/")({
  component: PedidosPage,
});

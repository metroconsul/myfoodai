import { createFileRoute } from "@tanstack/react-router";
import { PedidoPage } from "@/apps/compras/pages/pedido-page";

export const Route = createFileRoute("/_authenticated/compras/pedidos/$id")({
  component: PedidoRoute,
});

function PedidoRoute() {
  const { id } = Route.useParams();
  return <PedidoPage id={id} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { ReceberPage } from "@/apps/compras/pages/receber-page";

// ?pedido=<id> abre o recebimento já com os itens do pedido.
export const Route = createFileRoute("/_authenticated/compras/receber")({
  validateSearch: (s: Record<string, unknown>): { pedido?: string } => (typeof s["pedido"] === "string" ? { pedido: s["pedido"] } : {}),
  component: ReceberRoute,
});

function ReceberRoute() {
  const { pedido } = Route.useSearch();
  return <ReceberPage key={pedido ?? "novo"} pedidoId={pedido} />;
}

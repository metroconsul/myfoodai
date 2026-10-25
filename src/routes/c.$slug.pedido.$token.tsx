import { createFileRoute } from "@tanstack/react-router";
import { PublicOrderPage } from "@/apps/cardapio/pages/public-order-page";

// Acompanhamento do pedido pelo cliente (o código no link é secreto).
export const Route = createFileRoute("/c/$slug/pedido/$token")({
  head: () => ({ meta: [{ title: "Seu pedido" }, { name: "robots", content: "noindex" }] }),
  component: OrderRoute,
});

function OrderRoute() {
  const { slug, token } = Route.useParams();
  return <PublicOrderPage slug={slug} token={token} />;
}

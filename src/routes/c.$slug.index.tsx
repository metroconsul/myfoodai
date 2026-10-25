import { createFileRoute } from "@tanstack/react-router";
import { PublicMenuPage } from "@/apps/cardapio/pages/public-menu-page";

// Cardápio público da loja (sem login). ?mesa=5 vem do QR code da mesa.
export const Route = createFileRoute("/c/$slug/")({
  validateSearch: (s: Record<string, unknown>): { mesa?: string } =>
    typeof s["mesa"] === "string" || typeof s["mesa"] === "number" ? { mesa: String(s["mesa"]).slice(0, 20) } : {},
  head: () => ({ meta: [{ title: "Cardápio" }, { name: "robots", content: "noindex" }] }),
  component: MenuRoute,
});

function MenuRoute() {
  const { slug } = Route.useParams();
  const { mesa } = Route.useSearch();
  return <PublicMenuPage slug={slug} mesa={mesa} />;
}

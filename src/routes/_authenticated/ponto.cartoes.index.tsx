import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/apps/ponto/components/feature-guard";
import { PointCardsPage } from "@/apps/ponto/pages/point-cards-page";

export const Route = createFileRoute("/_authenticated/ponto/cartoes/")({
  component: () => (
    <FeatureGuard feature="point_cards">
      <PointCardsPage />
    </FeatureGuard>
  ),
});

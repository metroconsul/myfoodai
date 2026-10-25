import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/apps/ponto/components/feature-guard";
import { PointCardDetailPage } from "@/apps/ponto/pages/point-card-detail-page";

export const Route = createFileRoute("/_authenticated/ponto/cartoes/$id")({
  component: CardRoute,
});

function CardRoute() {
  const { id } = Route.useParams();
  return (
    <FeatureGuard feature="point_cards">
      <PointCardDetailPage id={id} />
    </FeatureGuard>
  );
}

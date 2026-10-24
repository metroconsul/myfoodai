import { createFileRoute } from "@tanstack/react-router";
import { CaixaSessionPage } from "@/apps/caixa-financeiro/pages/caixa-pages";

export const Route = createFileRoute("/_authenticated/caixa-financeiro/caixa/$sessionId")({
  component: SessionRoute,
});

function SessionRoute() {
  const { sessionId } = Route.useParams();
  return <CaixaSessionPage sessionId={sessionId} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui-kit";
import { usePontoRoles } from "@/apps/ponto/lib/roles";
import { AcceptancePolicyPage } from "@/apps/ponto/pages/acceptance-policy-page";

// Políticas de aceite (geocerca, prazo, validação facial do aceite). Compartilhadas com /app/settings/aceite.
export const Route = createFileRoute("/_authenticated/ponto/configuracoes")({
  component: ConfigRoute,
});

function ConfigRoute() {
  const { canConfigure } = usePontoRoles();
  return canConfigure ? <AcceptancePolicyPage /> : <EmptyState title="Só dono, administrador ou RH alteram as configurações." />;
}

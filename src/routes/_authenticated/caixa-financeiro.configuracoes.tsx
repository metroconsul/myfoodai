import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui-kit";
import { ConfigPage } from "@/apps/caixa-financeiro/pages/config-page";
import { useCfRoles } from "@/apps/caixa-financeiro/lib/hooks";

export const Route = createFileRoute("/_authenticated/caixa-financeiro/configuracoes")({
  component: ConfigRoute,
});

function ConfigRoute() {
  const { canFinance } = useCfRoles();
  if (!canFinance) return <EmptyState title="Configurações" description="Somente dono, administrador ou financeiro configuram o app." />;
  return <ConfigPage />;
}

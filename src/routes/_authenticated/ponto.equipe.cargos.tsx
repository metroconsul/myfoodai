import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/apps/ponto/components/feature-guard";
import { RolesTeamsPage } from "@/apps/ponto/pages/roles-teams-page";

export const Route = createFileRoute("/_authenticated/ponto/equipe/cargos")({
  component: () => (
    <FeatureGuard feature="roles_teams">
      <RolesTeamsPage />
    </FeatureGuard>
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/apps/ponto/components/feature-guard";
import { EmployeesPage } from "@/apps/ponto/pages/employees-page";

export const Route = createFileRoute("/_authenticated/ponto/equipe/")({
  component: () => (
    <FeatureGuard feature="employees">
      <EmployeesPage />
    </FeatureGuard>
  ),
});

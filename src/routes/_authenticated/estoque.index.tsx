import { createFileRoute } from "@tanstack/react-router";
import { EstoqueDashboardPage } from "@/apps/estoque/pages/dashboard-page";

export const Route = createFileRoute("/_authenticated/estoque/")({
  component: EstoqueDashboardPage,
});

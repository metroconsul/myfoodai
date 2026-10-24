import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/apps/caixa-financeiro/pages/dashboard-page";

export const Route = createFileRoute("/_authenticated/caixa-financeiro/")({
  component: DashboardPage,
});

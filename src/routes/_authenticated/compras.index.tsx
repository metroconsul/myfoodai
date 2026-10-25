import { createFileRoute } from "@tanstack/react-router";
import { ComprasDashboardPage } from "@/apps/compras/pages/dashboard-page";

export const Route = createFileRoute("/_authenticated/compras/")({
  component: ComprasDashboardPage,
});

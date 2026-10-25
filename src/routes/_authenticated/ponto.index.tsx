import { createFileRoute } from "@tanstack/react-router";
import { PontoDashboardPage } from "@/apps/ponto/pages/dashboard-page";

export const Route = createFileRoute("/_authenticated/ponto/")({
  component: PontoDashboardPage,
});

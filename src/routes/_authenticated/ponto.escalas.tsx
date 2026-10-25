import { createFileRoute } from "@tanstack/react-router";
import { EscalasPage } from "@/apps/ponto/pages/escalas-page";

export const Route = createFileRoute("/_authenticated/ponto/escalas")({
  component: EscalasPage,
});

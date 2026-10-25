import { createFileRoute } from "@tanstack/react-router";
import { RegistrosPage } from "@/apps/ponto/pages/registros-page";

export const Route = createFileRoute("/_authenticated/ponto/registros")({
  component: RegistrosPage,
});

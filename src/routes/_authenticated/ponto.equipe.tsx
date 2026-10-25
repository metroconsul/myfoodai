import { createFileRoute } from "@tanstack/react-router";
import { EquipeLayout } from "@/apps/ponto/components/sections";

export const Route = createFileRoute("/_authenticated/ponto/equipe")({
  component: EquipeLayout,
});

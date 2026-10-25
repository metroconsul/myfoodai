import { createFileRoute } from "@tanstack/react-router";
import { BRAND_NAME } from "@/config/brand";
import { RolesTeamsPage } from "@/apps/ponto/pages/roles-teams-page";

// Mesma tela do app MyFoods Ponto; continua aqui porque Documentos/EPIs também usam.
export const Route = createFileRoute("/_authenticated/app/roles-teams")({
  head: () => ({ meta: [{ title: `Cargos e equipes — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] }),
  component: RolesTeamsPage,
});

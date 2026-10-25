import { createFileRoute } from "@tanstack/react-router";
import { BRAND_NAME } from "@/config/brand";
import { AcceptancePolicyPage } from "@/apps/ponto/pages/acceptance-policy-page";

// Mesma tela do app MyFoods Ponto; continua aqui porque Documentos/EPIs também usam.
export const Route = createFileRoute("/_authenticated/app/settings/aceite")({
  head: () => ({ meta: [{ title: `Políticas de aceite — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] }),
  component: AcceptancePolicyPage,
});

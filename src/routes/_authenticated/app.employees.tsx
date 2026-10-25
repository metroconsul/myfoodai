import { createFileRoute } from "@tanstack/react-router";
import { BRAND_NAME } from "@/config/brand";
import { EmployeesPage } from "@/apps/ponto/pages/employees-page";

// Mesma tela do app MyFoods Ponto; continua aqui porque Documentos/EPIs também usam.
export const Route = createFileRoute("/_authenticated/app/employees")({
  head: () => ({ meta: [{ title: `Colaboradores — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] }),
  component: EmployeesPage,
});

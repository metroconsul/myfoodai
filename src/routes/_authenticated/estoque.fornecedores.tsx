import { createFileRoute } from "@tanstack/react-router";
import { FornecedoresPage } from "@/apps/estoque/pages/fornecedores-page";

export const Route = createFileRoute("/_authenticated/estoque/fornecedores")({
  component: FornecedoresPage,
});

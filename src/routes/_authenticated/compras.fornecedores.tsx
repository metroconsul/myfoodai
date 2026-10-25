import { createFileRoute } from "@tanstack/react-router";
import { FornecedoresPage } from "@/apps/estoque/pages/fornecedores-page";

// Mesmo cadastro de fornecedores do Estoque.
export const Route = createFileRoute("/_authenticated/compras/fornecedores")({
  component: FornecedoresPage,
});

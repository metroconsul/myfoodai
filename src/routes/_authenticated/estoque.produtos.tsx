import { createFileRoute } from "@tanstack/react-router";
import { ProdutosPage } from "@/apps/estoque/pages/produtos-page";

export const Route = createFileRoute("/_authenticated/estoque/produtos")({
  component: ProdutosPage,
});

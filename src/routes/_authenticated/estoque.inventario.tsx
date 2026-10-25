import { createFileRoute } from "@tanstack/react-router";
import { InventarioPage } from "@/apps/estoque/pages/inventario-page";

export const Route = createFileRoute("/_authenticated/estoque/inventario")({
  component: InventarioPage,
});

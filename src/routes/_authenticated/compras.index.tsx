import { createFileRoute } from "@tanstack/react-router";
import { ListasPage } from "@/apps/compras/pages/listas-page";

export const Route = createFileRoute("/_authenticated/compras/")({
  component: ListasPage,
});

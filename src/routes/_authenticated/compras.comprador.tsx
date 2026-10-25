import { createFileRoute } from "@tanstack/react-router";
import { CompradorPage } from "@/apps/compras/pages/comprador-page";

export const Route = createFileRoute("/_authenticated/compras/comprador")({
  component: CompradorPage,
});

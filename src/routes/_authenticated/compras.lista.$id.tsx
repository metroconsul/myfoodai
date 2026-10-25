import { createFileRoute } from "@tanstack/react-router";
import { ListaPage } from "@/apps/compras/pages/lista-page";

export const Route = createFileRoute("/_authenticated/compras/lista/$id")({
  component: ListaRoute,
});

function ListaRoute() {
  const { id } = Route.useParams();
  return <ListaPage key={id} id={id} />;
}

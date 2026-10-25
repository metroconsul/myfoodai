import { createFileRoute, redirect } from "@tanstack/react-router";

// Tela movida para o app MyFoods Ponto (P1, 2026-10-24); o endereço antigo continua funcionando.
export const Route = createFileRoute("/_authenticated/app/point-cards/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/ponto/cartoes/$id", params: { id: params.id }, replace: true });
  },
});

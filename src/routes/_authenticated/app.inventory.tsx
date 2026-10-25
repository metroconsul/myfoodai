import { createFileRoute, redirect } from "@tanstack/react-router";

// Tela movida para o app MyFoods Estoque (2026-10-25); o endereço antigo continua funcionando.
export const Route = createFileRoute("/_authenticated/app/inventory")({
  beforeLoad: () => {
    throw redirect({ to: "/estoque", replace: true });
  },
});

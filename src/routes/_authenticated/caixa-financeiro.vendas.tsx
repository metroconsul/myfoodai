import { createFileRoute } from "@tanstack/react-router";
import { VendasPage } from "@/apps/caixa-financeiro/pages/vendas-page";

// Vendas dentro do Caixa (decisão de 2026-10-24): vendas do caixa para todos; vendas importadas do PDV
// aparecem na mesma tela quando o plano tem o recurso "sales".
export const Route = createFileRoute("/_authenticated/caixa-financeiro/vendas")({
  component: VendasPage,
});

/** Textos de exibição do ponto (os valores no banco continuam os mesmos). */

export const ENTRY_TYPE_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  intervalo_saida: "Saída para intervalo",
  intervalo_retorno: "Volta do intervalo",
};

export const GEO_STATUS_LABEL: Record<string, string> = {
  dentro_do_raio: "Dentro do raio",
  fora_do_raio: "Fora do raio",
  localizacao_indisponivel: "Sem localização",
  revisao_necessaria: "Revisar",
};

export const label = (map: Record<string, string>, value: string | null | undefined) =>
  value ? (map[value] ?? value.replaceAll("_", " ")) : "—";

/** Batida que precisa de atenção do gestor: fora do raio, sem GPS ou ainda não validada. */
export function needsReview(e: { geo_status: string; validation_status: string }) {
  return e.geo_status !== "dentro_do_raio" || !["valido", "aprovado"].includes(e.validation_status);
}

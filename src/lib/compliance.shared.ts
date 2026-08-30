/** Constantes e rótulos do módulo Conformidade e equipe (client-safe). */

export const DOCUMENT_TYPES = [
  "aso_admissional",
  "aso_periodico",
  "aso_retorno",
  "aso_mudanca_funcao",
  "aso_demissional",
  "exame_sangue",
  "exame_clinico",
  "exame_complementar",
  "atestado_ocupacional",
  "outro",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  aso_admissional: "ASO admissional",
  aso_periodico: "ASO periódico",
  aso_retorno: "ASO de retorno ao trabalho",
  aso_mudanca_funcao: "ASO de mudança de função",
  aso_demissional: "ASO demissional",
  exame_sangue: "Exame de sangue",
  exame_clinico: "Exame clínico",
  exame_complementar: "Exame complementar",
  atestado_ocupacional: "Atestado ou documento ocupacional",
  outro: "Outro documento",
};

/** Documentos com conteúdo de saúde exigem proteção adicional na exibição. */
export const HEALTH_DOCUMENT_TYPES: DocumentType[] = [
  "exame_sangue",
  "exame_clinico",
  "exame_complementar",
];

export const isHealthDocument = (type: string) =>
  HEALTH_DOCUMENT_TYPES.includes(type as DocumentType);

export const DOCUMENT_STATUSES = [
  "regular",
  "vence_em_breve",
  "vencido",
  "agendado",
  "aguardando_documento",
  "em_revisao",
  "nao_aplicavel",
  "cancelado",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABEL: Record<string, string> = {
  regular: "Regular",
  vence_em_breve: "Vence em breve",
  vencido: "Vencido",
  agendado: "Agendado",
  aguardando_documento: "Aguardando documento",
  em_revisao: "Em revisão",
  nao_aplicavel: "Não aplicável",
  cancelado: "Cancelado",
};

export const DOCUMENT_STATUS_TONE: Record<
  string,
  "ok" | "warn" | "danger" | "neutral" | "info" | "brand"
> = {
  regular: "ok",
  vence_em_breve: "warn",
  vencido: "danger",
  agendado: "info",
  aguardando_documento: "warn",
  em_revisao: "info",
  nao_aplicavel: "neutral",
  cancelado: "neutral",
};

export const ACCESS_LEVELS = [
  "saude_ocupacional",
  "rh_autorizado",
  "gestor_autorizado",
  "administrativo",
] as const;

export const ACCESS_LEVEL_LABEL: Record<string, string> = {
  saude_ocupacional: "Somente colaborador e saúde ocupacional",
  rh_autorizado: "Colaborador e RH autorizado",
  gestor_autorizado: "Colaborador e gestor autorizado",
  administrativo: "Documento administrativo sem conteúdo clínico",
};

export const REQUEST_MODES = [
  "visualizar",
  "confirmar_ciencia",
  "enviar_documento",
  "assinar",
] as const;
export type RequestMode = (typeof REQUEST_MODES)[number];

export const REQUEST_MODE_LABEL: Record<string, string> = {
  visualizar: "Apenas visualizar",
  confirmar_ciencia: "Confirmar ciência",
  enviar_documento: "Enviar documento",
  assinar: "Assinar",
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  concluida: "Concluída",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export const EXCHANGE_STATUSES = [
  "solicitada",
  "em_analise",
  "aprovada",
  "aguardando_devolucao",
  "entregue",
  "recusada",
  "cancelada",
  "concluida",
] as const;
export type ExchangeStatus = (typeof EXCHANGE_STATUSES)[number];

export const EXCHANGE_STATUS_LABEL: Record<string, string> = {
  solicitada: "Solicitada",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  aguardando_devolucao: "Aguardando devolução",
  entregue: "Entregue",
  recusada: "Recusada",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

export const EXCHANGE_STATUS_TONE: Record<
  string,
  "ok" | "warn" | "danger" | "neutral" | "info" | "brand"
> = {
  solicitada: "warn",
  em_analise: "info",
  aprovada: "brand",
  aguardando_devolucao: "warn",
  entregue: "ok",
  recusada: "danger",
  cancelada: "neutral",
  concluida: "ok",
};

export const EXCHANGE_REASONS = [
  "troca_tamanho",
  "troca_desgaste",
  "troca_dano",
  "mudanca_funcao",
  "mudanca_unidade",
  "perda",
  "devolucao",
  "outro",
] as const;

export const EXCHANGE_REASON_LABEL: Record<string, string> = {
  troca_tamanho: "Troca por tamanho",
  troca_desgaste: "Troca por desgaste",
  troca_dano: "Troca por dano",
  mudanca_funcao: "Mudança de função",
  mudanca_unidade: "Mudança de unidade",
  perda: "Perda",
  devolucao: "Devolução",
  outro: "Outro",
};

export const RETURN_CONDITIONS = ["novo", "bom", "desgastado", "danificado", "nao_devolvido"] as const;

export const RETURN_CONDITION_LABEL: Record<string, string> = {
  novo: "Novo",
  bom: "Bom",
  desgastado: "Desgastado",
  danificado: "Danificado",
  nao_devolvido: "Não devolvido",
};

/** Janelas determinísticas de alerta (sem IA). */
export const ALERT_WINDOWS = [7, 15, 30, 60, 90] as const;

export const DOC_TERMS_VERSION = "termo-documento-v1";
export const DOC_CONSENT_VERSION = "consentimento-documento-v1";

export const DOC_TERMS = [
  "Declaro que visualizei o documento disponibilizado pela empresa e estou ciente do seu conteúdo administrativo.",
  "Estou ciente do prazo de revisão informado e das próximas ações indicadas.",
  "Autorizo o registro eletrônico desta confirmação, incluindo data, hora e, quando exigido pela política da empresa, localização aproximada.",
];

/** Diferença em dias entre hoje e uma data ISO (positivo = futuro). */
export function daysUntil(date?: string | null) {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Status derivado de forma determinística a partir das datas.
 * Não altera status manuais como agendado, cancelado ou não aplicável.
 */
export function effectiveDocumentStatus(
  status: string,
  expiresAt?: string | null,
  windowDays = 30,
): DocumentStatus {
  if (status !== "regular" && status !== "vence_em_breve" && status !== "vencido") {
    return status as DocumentStatus;
  }
  const days = daysUntil(expiresAt);
  if (days == null) return "regular";
  if (days < 0) return "vencido";
  if (days <= windowDays) return "vence_em_breve";
  return "regular";
}

export const KIT_CATEGORIES = [
  "camiseta",
  "calca",
  "avental",
  "touca",
  "luva",
  "calcado",
  "mascara",
  "cracha",
  "jaqueta",
  "kit_funcao",
  "outro",
] as const;

export const KIT_CATEGORY_LABEL: Record<string, string> = {
  camiseta: "Camiseta",
  calca: "Calça",
  avental: "Avental",
  touca: "Touca",
  luva: "Luva",
  calcado: "Calçado",
  mascara: "Máscara",
  cracha: "Crachá",
  jaqueta: "Jaqueta",
  kit_funcao: "Kit por função",
  outro: "Outro item operacional",
};

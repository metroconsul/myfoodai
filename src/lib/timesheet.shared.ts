/** Constantes e rótulos do módulo de Cartões de ponto (client-safe). */

export const CARD_STATUSES = [
  "rascunho",
  "em_revisao",
  "publicado",
  "em_validacao",
  "divergente",
  "corrigido",
  "assinado",
  "expirado",
  "reaberto",
  "erro_publicacao",
] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const CARD_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  publicado: "Aguardando assinatura",
  em_validacao: "Validação em andamento",
  divergente: "Divergência enviada",
  corrigido: "Corrigido",
  assinado: "Assinado",
  expirado: "Expirado",
  reaberto: "Reaberto",
  erro_publicacao: "Erro de publicação",
};

/** Mensagem exibida ao colaborador para cada estado. */
export const CARD_STATUS_MESSAGE: Record<string, string> = {
  rascunho: "Este cartão ainda não foi fechado.",
  em_revisao: "O cartão está sendo conferido pela empresa.",
  publicado: "Confira os registros e assine quando estiver de acordo.",
  em_validacao: "Estamos confirmando os dados do seu aceite.",
  divergente: "Sua divergência foi enviada para análise.",
  corrigido: "O cartão foi atualizado. Faça uma nova conferência.",
  assinado: "Cartão assinado e comprovante disponível.",
  expirado: "O prazo de conferência terminou. Fale com o responsável.",
  reaberto: "Este cartão foi reaberto pela empresa.",
  erro_publicacao: "Não foi possível publicar este cartão. Tente novamente ou revise os dados.",
};

export const CARD_STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "neutral" | "info" | "brand"> = {
  rascunho: "neutral",
  em_revisao: "info",
  publicado: "warn",
  em_validacao: "info",
  divergente: "danger",
  corrigido: "warn",
  assinado: "ok",
  expirado: "neutral",
  reaberto: "warn",
  erro_publicacao: "danger",
};

/** Estados em que o colaborador ainda pode conferir e assinar. */
export const OPEN_FOR_SIGNATURE: readonly string[] = [
  "publicado",
  "em_validacao",
  "corrigido",
  "reaberto",
];

export const BATCH_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  preparando: "Preparando",
  publicando: "Publicando",
  publicado_parcial: "Publicado parcialmente",
  publicado: "Publicado",
  com_erros: "Com erros",
  cancelado: "Cancelado",
};

export const DISPUTE_CATEGORIES = [
  "entrada",
  "intervalo",
  "saida",
  "falta",
  "hora_extra",
  "sem_registro",
  "outro",
] as const;
export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];

export const DISPUTE_CATEGORY_LABEL: Record<string, string> = {
  entrada: "Entrada",
  intervalo: "Intervalo",
  saida: "Saída",
  falta: "Falta",
  hora_extra: "Hora extra",
  sem_registro: "Ausência de registro",
  outro: "Outro",
};

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  aberta: "Em análise",
  respondida: "Respondida",
  resolvida: "Resolvida",
};

export const ALERT_LABEL: Record<string, string> = {
  batida_faltante: "Batida faltante",
  intervalo_incompleto: "Intervalo incompleto",
  registro_duplicado: "Registro duplicado",
  jornada_fora_config: "Jornada fora da configuração",
  sem_dados: "Sem registros no dia",
};

export const TIMESHEET_TERMS_VERSION = "termo-cartao-ponto-v1";
export const TIMESHEET_CONSENT_VERSION = "consentimento-cartao-ponto-v1";

export const TIMESHEET_TERM =
  "Declaro que conferi o cartão de ponto apresentado para o período indicado e estou ciente dos registros nele contidos. Caso exista alguma divergência, devo utilizar o canal disponibilizado pela empresa.";

export const TIMESHEET_DISCLAIMER =
  "Aceite eletrônico auditável. Este é um documento para conferência; a empresa deve validar os requisitos trabalhistas e de proteção de dados aplicáveis ao seu contexto.";

export const ABSENCE_LABEL: Record<string, string> = {
  falta: "Falta",
  folga: "Folga",
  ferias: "Férias",
  afastamento: "Afastamento",
};

export type TimesheetSummary = {
  planned_minutes: number;
  worked_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
  absence_days: number;
  balance_minutes: number;
  missing_punches: number;
  alerts: string[];
};

export const EMPTY_SUMMARY: TimesheetSummary = {
  planned_minutes: 0,
  worked_minutes: 0,
  overtime_minutes: 0,
  late_minutes: 0,
  absence_days: 0,
  balance_minutes: 0,
  missing_punches: 0,
  alerts: [],
};

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y!, m ?? 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function monthLabel(periodStart: string) {
  const d = new Date(`${periodStart}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

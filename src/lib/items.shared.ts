/** Constantes e rótulos do módulo de Itens e Entregas (client-safe). */
import type { Enums } from "@/integrations/supabase/types";

export const ITEM_CATEGORIES = [
  "uniforme",
  "protecao",
  "higiene",
  "acessorio",
  "material_apoio",
  "outro",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<string, string> = {
  uniforme: "Uniforme",
  protecao: "Proteção",
  higiene: "Higiene",
  acessorio: "Acessório",
  material_apoio: "Material de apoio",
  outro: "Personalizada",
};

/** Tipo operacional armazenado no catálogo (enum do banco). */
export const CATEGORY_TO_ITEM_TYPE: Record<string, Enums<"item_type">> = {
  uniforme: "uniforme",
  protecao: "protecao_individual",
  higiene: "limpeza",
  acessorio: "consumo",
  material_apoio: "consumo",
  outro: "consumo",
};

export const UNITS_OF_MEASURE = ["unidade", "par", "caixa", "pacote", "kit"] as const;

export const SIZE_PRESETS = ["Único", "PP", "P", "M", "G", "GG", "XGG"] as const;

export const REPLACEMENT_PERIODS = [
  "sem_periodicidade",
  "diaria",
  "semanal",
  "mensal",
  "trimestral",
  "semestral",
  "anual",
] as const;

export const PERIOD_LABEL: Record<string, string> = {
  sem_periodicidade: "Sem periodicidade",
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const PERIOD_DAYS: Record<string, number | null> = {
  sem_periodicidade: null,
  diaria: 1,
  semanal: 7,
  mensal: 30,
  trimestral: 90,
  semestral: 180,
  anual: 365,
};

export const DELIVERY_REASONS = [
  "admissao",
  "troca",
  "reposicao",
  "perda",
  "dano",
  "mudanca_funcao",
  "retorno",
  "outro",
] as const;
export type DeliveryReason = (typeof DELIVERY_REASONS)[number];

export const REASON_LABEL: Record<string, string> = {
  admissao: "Admissão",
  troca: "Troca",
  reposicao: "Reposição",
  perda: "Perda",
  dano: "Dano",
  mudanca_funcao: "Mudança de função",
  retorno: "Retorno",
  outro: "Outro",
};

export const DELIVERY_STATUSES = [
  "rascunho",
  "aguardando_aceite",
  "em_validacao",
  "assinado",
  "recusado",
  "divergente",
  "expirado",
  "cancelado",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aceite: "Aguardando aceite",
  em_validacao: "Em validação",
  assinado: "Assinado",
  recusado: "Recusado",
  divergente: "Divergência",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

export const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "neutral" | "info" | "brand"> = {
  rascunho: "neutral",
  aguardando_aceite: "warn",
  em_validacao: "info",
  assinado: "ok",
  recusado: "danger",
  divergente: "danger",
  expirado: "neutral",
  cancelado: "neutral",
};

export const FACE_STATUS_LABEL: Record<string, string> = {
  nao_realizada: "Não realizada",
  aprovado: "Validação concluída",
  reprovado: "Falha na validação",
  indisponivel: "Serviço indisponível",
  dispensada: "Dispensada com justificativa",
};

export const LOCATION_STATUS_LABEL: Record<string, string> = {
  nao_disponivel: "Não disponível",
  obtida: "Localização registrada",
  negada: "Permissão negada",
  imprecisa: "Localização imprecisa",
  indisponivel: "Indisponível no dispositivo",
};

export const TERMS_VERSION = "termo-recebimento-v1";
export const CONSENT_VERSION = "consentimento-v1";

export const RECEIPT_TERMS = [
  "Declaro que recebi os itens listados neste comprovante, nas quantidades, tamanhos e cores indicados.",
  "Comprometo-me a utilizar e conservar os itens conforme as orientações e políticas internas da empresa.",
  "Autorizo o registro eletrônico deste recebimento, incluindo assinatura, validação de identidade e localização aproximada, conforme a política de privacidade da empresa.",
];

export function stockTone(quantity: number, minimum: number, active: boolean) {
  if (!active) return { label: "Inativo", tone: "neutral" as const };
  if (quantity <= 0) return { label: "Sem estoque", tone: "danger" as const };
  if (quantity <= minimum) return { label: "Estoque baixo", tone: "warn" as const };
  return { label: "Em estoque", tone: "ok" as const };
}

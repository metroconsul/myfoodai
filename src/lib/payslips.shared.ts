/** Constantes e rótulos do módulo de Holerites (client-safe). */

export const PAYSLIP_STATUSES = [
  "draft",
  "validating",
  "validation_error",
  "published",
  "viewed",
  "awaiting_signature",
  "signed",
  "dispute_open",
  "corrected",
  "expired",
  "cancelled",
  "archived",
] as const;
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];

export const PAYSLIP_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  validating: "Em validação",
  validation_error: "Erro de importação",
  published: "Publicado",
  viewed: "Visualizado",
  awaiting_signature: "Aguardando assinatura",
  signed: "Assinado",
  dispute_open: "Com divergência",
  corrected: "Corrigido",
  expired: "Prazo encerrado",
  cancelled: "Cancelado",
  archived: "Arquivado",
};

export const PAYSLIP_STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "neutral" | "brand" | "info"> = {
  draft: "neutral",
  validating: "info",
  validation_error: "danger",
  published: "brand",
  viewed: "info",
  awaiting_signature: "warn",
  signed: "ok",
  dispute_open: "danger",
  corrected: "info",
  expired: "warn",
  cancelled: "neutral",
  archived: "neutral",
};

/** Status considerados pendentes de ação do colaborador. */
export const PENDING_STATUSES: PayslipStatus[] = [
  "published",
  "viewed",
  "awaiting_signature",
  "corrected",
];

export const ACCEPTANCE_POLICIES = [
  "visualizacao",
  "ciencia",
  "assinatura",
  "assinatura_facial_geo",
] as const;
export type AcceptancePolicy = (typeof ACCEPTANCE_POLICIES)[number];

export const POLICY_LABEL: Record<string, string> = {
  visualizacao: "Apenas visualização",
  ciencia: "Visualização e confirmação de ciência",
  assinatura: "Visualização e assinatura eletrônica",
  assinatura_facial_geo: "Assinatura com validação facial e geolocalização",
};

export const POLICY_HINT: Record<string, string> = {
  visualizacao: "O colaborador apenas abre o documento. Nenhum aceite é exigido.",
  ciencia: "O colaborador confirma que teve acesso ao documento.",
  assinatura: "O colaborador assina eletronicamente com termo de ciência.",
  assinatura_facial_geo:
    "Exige validação de identidade com prova de vida e captura de localização no aceite.",
};

export const requiresAcceptance = (policy: string) => policy !== "visualizacao";
export const requiresSignature = (policy: string) =>
  policy === "assinatura" || policy === "assinatura_facial_geo";
export const requiresFace = (policy: string) => policy === "assinatura_facial_geo";

export const DISPUTE_CATEGORIES = [
  "identificacao",
  "competencia",
  "valor",
  "desconto",
  "ausencia_informacao",
  "outro",
] as const;

export const DISPUTE_CATEGORY_LABEL: Record<string, string> = {
  identificacao: "Identificação",
  competencia: "Competência",
  valor: "Valor",
  desconto: "Desconto",
  ausencia_informacao: "Ausência de informação",
  outro: "Outro",
};

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_colaborador: "Aguardando colaborador",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};

/** Estados reais da integração de validação facial (sem simulação). */
export const FACE_STATES = [
  "not_required",
  "not_started",
  "in_progress",
  "approved",
  "rejected",
  "cancelled",
  "expired",
  "provider_unavailable",
] as const;

export const FACE_STATE_LABEL: Record<string, string> = {
  not_required: "Não exigida",
  not_started: "Não iniciada",
  in_progress: "Em andamento",
  approved: "Aprovada",
  rejected: "Reprovada",
  cancelled: "Cancelada",
  expired: "Expirada",
  provider_unavailable: "Provedor indisponível",
};

export const LOCATION_STATE_LABEL: Record<string, string> = {
  obtida: "Capturada",
  negada: "Permissão negada",
  imprecisa: "Imprecisa",
  indisponivel: "Indisponível",
  nao_disponivel: "Não solicitada",
};

export const PAYSLIP_TERM_VERSION = "termo-holerite-v1";

export const PAYSLIP_TERM_TEXT =
  "Declaro que tive acesso ao documento referente à competência indicada e que realizei sua conferência. Este aceite eletrônico registra minha ciência sobre a disponibilização do documento, sem impedir a solicitação de correções ou esclarecimentos pelos canais oficiais da empresa.";

export const ACCEPTED_MIME = ["application/pdf", "image/png", "image/jpeg"];

/** "2026-08-01" → "08/2026". */
export function competenceLabel(period?: string | null) {
  if (!period) return "—";
  const [y, m] = period.slice(0, 10).split("-");
  return m && y ? `${m}/${y}` : period;
}

/** "08/2026" ou "2026-08" → "2026-08-01". */
export function competenceToDate(input: string): string | null {
  const t = input.trim();
  let year: string | undefined;
  let month: string | undefined;
  if (/^\d{2}\/\d{4}$/.test(t)) [month, year] = t.split("/");
  else if (/^\d{4}-\d{2}$/.test(t)) [year, month] = t.split("-");
  else if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (!year || !month) return null;
  const mn = Number(month);
  if (mn < 1 || mn > 12) return null;
  return `${year}-${month.padStart(2, "0")}-01`;
}

export function currentCompetence() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function shortHash(hash?: string | null) {
  if (!hash) return "—";
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

export const AUDIT_EVENT_LABEL: Record<string, string> = {
  "payslip.created": "Holerite criado",
  "payslip.uploaded": "Arquivo enviado",
  "payslip.upload_failed": "Falha no envio do arquivo",
  "payslip.validated": "Validação concluída",
  "payslip.validation_failed": "Falha de validação",
  "payslip.published": "Publicado no portal",
  "payslip.publication_failed": "Falha na publicação",
  "payslip.viewed": "Visualizado pelo colaborador",
  "payslip.downloaded": "Documento baixado",
  "payslip.download_denied": "Download negado",
  "payslip.signature_started": "Assinatura iniciada",
  "payslip.signature_completed": "Assinatura concluída",
  "payslip.signature_failed": "Falha na assinatura",
  "payslip.face_validation_started": "Validação facial iniciada",
  "payslip.face_validation_completed": "Validação facial concluída",
  "payslip.face_validation_failed": "Falha na validação facial",
  "payslip.location_requested": "Localização solicitada",
  "payslip.location_captured": "Localização capturada",
  "payslip.location_denied": "Localização negada",
  "payslip.dispute_created": "Divergência aberta",
  "payslip.dispute_resolved": "Divergência resolvida",
  "payslip.version_created": "Nova versão criada",
  "payslip.cancelled": "Publicação cancelada",
  "payslip.archived": "Arquivado",
  "payslip.exported": "Relatório exportado",
  "access.granted": "Acesso autorizado",
  "access.denied": "Acesso negado",
};

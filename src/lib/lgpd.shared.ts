/**
 * Consentimento LGPD compartilhado por todos os fluxos com assinatura do colaborador
 * (entrega de itens, cartão de ponto, documentos ocupacionais).
 */
export const LGPD_CONSENT_VERSION = "lgpd-v1";

export const LGPD_CONSENT_TITLE = "Autorizações e privacidade (LGPD)";

export const LGPD_DATA_TEXT =
  "Autorizo o tratamento dos meus dados pessoais necessários para registrar este aceite eletrônico (nome, matrícula, data, hora, dispositivo e assinatura), conforme a Lei nº 13.709/2018 (LGPD).";

export const LGPD_BIOMETRICS_TEXT =
  "Autorizo a captura de uma selfie para validação de identidade. A imagem é usada apenas para essa verificação e não é armazenada — guardamos somente o resultado.";

export const LGPD_LOCATION_TEXT =
  "Autorizo o registro da minha localização aproximada no momento do aceite (opcional).";

export const LGPD_NOTICE =
  "Finalidade: comprovar a autoria e a integridade deste aceite. Base legal: cumprimento de obrigação legal e execução do contrato de trabalho. Retenção: pelo prazo legal aplicável. Você pode solicitar acesso, correção ou exclusão dos seus dados ao RH da empresa.";

export type LgpdConsent = {
  data: boolean;
  biometrics: boolean;
  location: boolean;
};

export const EMPTY_LGPD_CONSENT: LgpdConsent = {
  data: false,
  biometrics: false,
  location: false,
};

/** Registro serializável guardado junto às evidências do aceite. */
export function consentRecord(consent: LgpdConsent, acceptedAt = new Date().toISOString()) {
  return {
    version: LGPD_CONSENT_VERSION,
    data: consent.data,
    biometrics: consent.biometrics,
    location: consent.location,
    acceptedAt,
  };
}

export function consentSummary(
  consent?: { data?: boolean; biometrics?: boolean; location?: boolean; version?: string } | null,
) {
  if (!consent) return "Não registrado";
  const yes = (v?: boolean) => (v ? "autorizado" : "não autorizado");
  return `Dados: ${yes(consent.data)} · Biometria: ${yes(consent.biometrics)} · Localização: ${yes(
    consent.location,
  )}${consent.version ? ` · ${consent.version}` : ""}`;
}

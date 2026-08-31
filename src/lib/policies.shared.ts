/**
 * Políticas de aceite e de privacidade (LGPD) por empresa.
 * Compartilhado entre painel do gestor, portal e camada de servidor.
 */

export type SignatureMethod = "visualizar" | "ciencia" | "assinatura" | "assinatura_facial";
export type FaceProvider = "lovable_ai" | "selfie_evidence" | "externo";
export type GeocodingProvider = "nominatim" | "custom" | "desativado";

export type AcceptancePolicy = {
  deadlineDays: number;
  signatureMethod: SignatureMethod;
  requireFace: boolean;
  requireLocation: boolean;
  allowTypedSignature: boolean;
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  geofenceBlockOutside: boolean;
  faceProvider: FaceProvider;
  faceProviderEndpoint: string | null;
  geocodingProvider: GeocodingProvider;
  geocodingEndpoint: string | null;
};

export const DEFAULT_ACCEPTANCE_POLICY: AcceptancePolicy = {
  deadlineDays: 5,
  signatureMethod: "assinatura_facial",
  requireFace: true,
  requireLocation: true,
  allowTypedSignature: true,
  geofenceEnabled: false,
  geofenceRadiusMeters: 200,
  geofenceBlockOutside: false,
  faceProvider: "lovable_ai",
  faceProviderEndpoint: null,
  geocodingProvider: "nominatim",
  geocodingEndpoint: null,
};

export const SIGNATURE_METHOD_LABEL: Record<SignatureMethod, string> = {
  visualizar: "Somente visualizar",
  ciencia: "Confirmar ciência",
  assinatura: "Assinatura eletrônica",
  assinatura_facial: "Assinatura com validação facial",
};

export const FACE_PROVIDER_LABEL: Record<FaceProvider, string> = {
  lovable_ai: "Validação facial gerenciada (padrão)",
  selfie_evidence: "Somente registro de selfie",
  externo: "Provedor externo (endpoint próprio)",
};

export const GEOCODING_PROVIDER_LABEL: Record<GeocodingProvider, string> = {
  nominatim: "OpenStreetMap Nominatim (padrão)",
  custom: "Endpoint próprio",
  desativado: "Não resolver endereço",
};

export type PrivacyPolicy = {
  controllerName: string | null;
  dpoName: string | null;
  dpoEmail: string | null;
  purposes: string[];
  legalBases: string[];
  retentionMonths: number;
  retentionNotes: string | null;
  privacyUrl: string | null;
  consentVersion: string;
  dataText: string | null;
  biometricsText: string | null;
  locationText: string | null;
  noticeText: string | null;
};

export const DEFAULT_PURPOSES = [
  "Comprovar autoria e integridade de aceites eletrônicos",
  "Cumprir obrigações trabalhistas e de segurança do trabalho",
  "Controlar entrega de itens e uniformes de uso obrigatório",
];

export const DEFAULT_LEGAL_BASES = [
  "Cumprimento de obrigação legal ou regulatória (art. 7º, II)",
  "Execução de contrato de trabalho (art. 7º, V)",
  "Consentimento para dados biométricos e localização (art. 11, I)",
];

export const DEFAULT_PRIVACY_POLICY: PrivacyPolicy = {
  controllerName: null,
  dpoName: null,
  dpoEmail: null,
  purposes: DEFAULT_PURPOSES,
  legalBases: DEFAULT_LEGAL_BASES,
  retentionMonths: 60,
  retentionNotes: null,
  privacyUrl: null,
  consentVersion: "lgpd-v1",
  dataText: null,
  biometricsText: null,
  locationText: null,
  noticeText: null,
};

export function retentionLabel(months: number) {
  if (months % 12 === 0) return `${months / 12} ano(s)`;
  return `${months} meses`;
}

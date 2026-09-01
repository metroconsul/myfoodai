import { z } from "zod";

export const geoSchema = {
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  locationStatus: z.enum(["obtida", "negada", "imprecisa", "indisponivel", "nao_disponivel"]),
};

export const consentSchema = {
  consentData: z.boolean().default(false),
  consentBiometrics: z.boolean().default(false),
  consentLocation: z.boolean().default(false),
};

export const tokenSchema = z.object({ token: z.string().min(10).max(200) });

export const cardSchema = tokenSchema.extend({ cardId: z.string().uuid() });

export const validateSchema = cardSchema.extend({
  imageDataUrl: z.string().min(64).max(4_000_000),
  ...geoSchema,
  ...consentSchema,
  deviceInfo: z.string().max(400).nullable().optional(),
});

export const signSchema = cardSchema.extend({
  signatureDataUrl: z.string().max(4_000_000).nullable().optional(),
  typedName: z.string().trim().max(160).nullable().optional(),
  signatureType: z.enum(["desenhada", "digitada"]),
  agreed: z.boolean(),
  ...geoSchema,
  ...consentSchema,
  deviceInfo: z.string().max(400).nullable().optional(),
  faceSkipReason: z.string().trim().max(300).nullable().optional(),
});

export const disputeSchema = cardSchema.extend({
  workDate: z.string().length(10).nullable().optional(),
  category: z.enum(["entrada", "intervalo", "saida", "falta", "hora_extra", "sem_registro", "outro"]),
  description: z.string().trim().min(5).max(1500),
});

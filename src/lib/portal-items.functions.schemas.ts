import { z } from "zod";

export const geoSchema = {
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  locationStatus: z.enum(["obtida", "negada", "imprecisa", "indisponivel", "nao_disponivel"]),
};

export const consentSchema = {
  consentData: z.boolean().default(false),
  consentBiometrics: z.boolean(),
  consentLocation: z.boolean(),
};

export const tokenSchema = z.object({ token: z.string().min(10).max(200) });

export const deliverySchema = tokenSchema.extend({ deliveryId: z.string().uuid() });

export const validateSchema = deliverySchema.extend({
  imageDataUrl: z.string().min(64).max(4_000_000),
  ...geoSchema,
  ...consentSchema,
  deviceInfo: z.string().max(400).nullable().optional(),
});

export const acceptSchema = deliverySchema.extend({
  signatureType: z.enum(["desenhada", "digitada"]),
  signatureDataUrl: z.string().max(4_000_000).nullable().optional(),
  typedName: z.string().trim().max(160).nullable().optional(),
  ...geoSchema,
  ...consentSchema,
  deviceInfo: z.string().max(400).nullable().optional(),
  faceSkipReason: z.string().trim().max(300).nullable().optional(),
});

export const refuseSchema = deliverySchema.extend({
  mode: z.enum(["recusado", "divergente"]),
  reason: z.string().trim().min(3).max(600),
});

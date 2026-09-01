import { z } from "zod";

export const acceptanceSchema = z.object({
  deadlineDays: z.number().int().min(1).max(90),
  signatureMethod: z.enum(["visualizar", "ciencia", "assinatura", "assinatura_facial"]),
  requireFace: z.boolean(),
  requireLocation: z.boolean(),
  allowTypedSignature: z.boolean(),
  geofenceEnabled: z.boolean(),
  geofenceRadiusMeters: z.number().int().min(20).max(20000),
  geofenceBlockOutside: z.boolean(),
  faceProvider: z.enum(["lovable_ai", "selfie_evidence", "externo"]),
  faceProviderEndpoint: z.string().trim().url().max(400).nullable().optional(),
  geocodingProvider: z.enum(["nominatim", "custom", "desativado"]),
  geocodingEndpoint: z.string().trim().url().max(400).nullable().optional(),
});

export const privacySchema = z.object({
  controllerName: z.string().trim().max(200).nullable().optional(),
  dpoName: z.string().trim().max(200).nullable().optional(),
  dpoEmail: z.string().trim().email().max(200).nullable().optional(),
  purposes: z.array(z.string().trim().min(3).max(300)).max(20),
  legalBases: z.array(z.string().trim().min(3).max(300)).max(20),
  retentionMonths: z.number().int().min(1).max(600),
  retentionNotes: z.string().trim().max(1000).nullable().optional(),
  privacyUrl: z.string().trim().url().max(400).nullable().optional(),
  consentVersion: z.string().trim().min(2).max(40),
  dataText: z.string().trim().max(1200).nullable().optional(),
  biometricsText: z.string().trim().max(1200).nullable().optional(),
  locationText: z.string().trim().max(1200).nullable().optional(),
  noticeText: z.string().trim().max(2000).nullable().optional(),
});

export const tokenSchema = z.object({ token: z.string().min(10).max(200) });

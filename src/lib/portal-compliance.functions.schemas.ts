import { z } from "zod";

export const tokenSchema = z.object({ token: z.string().min(10).max(200) });

export const docSchema = tokenSchema.extend({ documentId: z.string().uuid() });

export const ackSchema = docSchema.extend({
  mode: z.enum(["ciencia", "assinatura"]),
  consentData: z.boolean().default(false),
  consentLocation: z.boolean().default(false),
  signatureDataUrl: z.string().max(4_000_000).nullable().optional(),
  typedName: z.string().trim().max(160).nullable().optional(),
  ...geoFields,
  deviceInfo: z.string().max(400).nullable().optional(),
});

export const uploadSchema = tokenSchema.extend({
  requestId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(180),
  fileDataUrl: z.string().min(64).max(8_000_000),
});

export const exchangeSchema = tokenSchema.extend({
  deliveryId: z.string().uuid().nullable().optional(),
  itemId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(2).max(60),
  requestedSize: z.string().trim().max(40).nullable().optional(),
  requestedColor: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(800).nullable().optional(),
});

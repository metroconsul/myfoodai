import { z } from "zod";

export const loginSchema = z.object({
  cpf: z.string().min(11).max(20),
  pin: z.string().min(4).max(12),
});

export const tokenSchema = z.object({ token: z.string().min(10).max(200) });

export const rangeSchema = tokenSchema.extend({
  from: z.string().min(10).max(10),
  to: z.string().min(10).max(10),
});

export const punchSchema = tokenSchema.extend({
  entryType: z.enum(["entrada", "intervalo_saida", "intervalo_retorno", "saida"]),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  deviceTime: z.string().nullable().optional(),
  userAgent: z.string().max(400).nullable().optional(),
});

export const correctionSchema = tokenSchema.extend({
  timeEntryId: z.string().uuid().nullable().optional(),
  requestedTime: z.string().nullable().optional(),
  requestedEntryType: z
    .enum(["entrada", "intervalo_saida", "intervalo_retorno", "saida"])
    .nullable()
    .optional(),
  reason: z.string().trim().min(3).max(500),
});

export const ackSchema = tokenSchema.extend({
  pointCardId: z.string().uuid(),
});

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

export const payslipSchema = tokenSchema.extend({ payslipId: z.string().uuid() });

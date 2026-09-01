import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const provisionSchema = z.object({
  email: z.string().trim().email().max(200),
  organizationName: z.string().trim().min(2).max(120),
  unitName: z.string().trim().min(2).max(120),
  unitType: z.enum([
    "restaurante",
    "bar",
    "cafeteria",
    "lanchonete",
    "padaria",
    "cozinha",
    "varejo",
    "outro",
  ]),
  city: z.string().trim().max(120).optional(),
  responsibleName: z.string().trim().max(120).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  breakStart: z.string().regex(timeRegex).nullable().optional(),
  breakEnd: z.string().regex(timeRegex).nullable().optional(),
  billingCycle: z.enum(["mensal", "anual"]),
  accessMode: z.enum(["trial", "admin_grant", "subscription"]),
  trialDays: z.number().int().min(1).max(180).optional(),
  grantReason: z.string().trim().max(300).optional(),
  redirectOrigin: z.string().url().max(200),
});

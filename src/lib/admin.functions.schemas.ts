import { z } from "zod";

export const pinSchema = z.object({
  employeeId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,8}$/, "O PIN deve ter de 4 a 8 dígitos."),
});

export const cardSchema = z.object({
  employeeId: z.string().uuid(),
  periodStart: z.string().length(10),
  periodEnd: z.string().length(10),
});

export const sendSchema = z.object({
  pointCardId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email", "link"]),
  recipient: z.string().trim().min(3).max(200),
});

export const bootstrapSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  brandName: z.string().trim().max(120).optional(),
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
  fullName: z.string().trim().max(120).optional(),
});

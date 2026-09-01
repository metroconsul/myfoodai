import { z } from "zod";

export const itemSchema = z.object({
  catalogItemId: z.string().uuid(),
  quantity: z.number().positive().max(9999),
  size: z.string().trim().max(40).nullable().optional(),
  color: z.string().trim().max(40).nullable().optional(),
  lot: z.string().trim().max(60).nullable().optional(),
});

export const createSchema = z.object({
  unitId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(200),
  items: z.array(itemSchema).min(1).max(30),
  reason: z.enum([
    "admissao",
    "troca",
    "reposicao",
    "perda",
    "dano",
    "mudanca_funcao",
    "retorno",
    "outro",
  ]),
  notes: z.string().trim().max(1000).nullable().optional(),
  deliveredAt: z.string().min(10).max(40),
  responsibleLabel: z.string().trim().max(160).nullable().optional(),
  allowPartial: z.boolean().default(false),
});

export const cancelSchema = z.object({
  deliveryId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  restoreStock: z.boolean().default(true),
});

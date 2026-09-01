import { z } from "zod";

export const periodSchema = z.object({
  unitId: z.string().uuid(),
  periodStart: z.string().length(10),
  periodEnd: z.string().length(10),
});

export const publishSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(500),
  force: z.boolean().default(false),
});

export const entryPatchSchema = z.object({
  entryId: z.string().uuid(),
  clockIn: z.string().max(40).nullable().optional(),
  breakStart: z.string().max(40).nullable().optional(),
  breakEnd: z.string().max(40).nullable().optional(),
  clockOut: z.string().max(40).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  justification: z.string().trim().max(500).nullable().optional(),
});

export const prepareSchema = periodSchema.extend({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
  deadlineAt: z.string().max(40).nullable().optional(),
  timezone: z.string().max(60).default("America/Sao_Paulo"),
});

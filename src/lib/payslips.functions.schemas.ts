import { z } from "zod";

const MAX_FILE_DATA_URL = 12_000_000; // ~8MB binário

export const fileSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileDataUrl: z.string().min(64).max(MAX_FILE_DATA_URL),
});

export const batchSchema = z.object({
  payrollPeriod: z.string().length(10),
  acceptancePolicy: z.enum(["visualizacao", "ciencia", "assinatura", "assinatura_facial_geo"]),
  dueAt: z.string().max(40).nullable().optional(),
  publishNow: z.boolean().default(false),
  files: z
    .array(
      fileSchema.extend({
        matchKey: z.string().trim().min(3).max(60),
      }),
    )
    .min(1)
    .max(40),
});

export const createSchema = fileSchema.extend({
  employeeId: z.string().uuid(),
  payrollPeriod: z.string().length(10),
  referenceLabel: z.string().trim().max(120).nullable().optional(),
  acceptancePolicy: z.enum(["visualizacao", "ciencia", "assinatura", "assinatura_facial_geo"]),
  dueAt: z.string().max(40).nullable().optional(),
  publishNow: z.boolean().default(false),
});

export const versionSchema = fileSchema.extend({
  payslipId: z.string().uuid(),
  correctionReason: z.string().trim().min(3).max(600),
});

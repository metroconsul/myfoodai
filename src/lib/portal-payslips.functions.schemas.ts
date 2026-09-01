import { z } from "zod";

export const tokenSchema = z.object({ token: z.string().min(10).max(200) });

export const payslipSchema = tokenSchema.extend({ payslipId: z.string().uuid() });

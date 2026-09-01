import { z } from "zod";

export const payloadSchema = z.object({
  unitId: z.string().uuid(),
  metrics: z
    .array(
      z.object({
        date: z.string().min(10).max(10),
        grossAmount: z.number().finite(),
        netAmount: z.number().finite().nullable().optional(),
        ordersCount: z.number().int().nonnegative().default(0),
        cancellations: z.number().int().nonnegative().default(0),
        discounts: z.number().finite().nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

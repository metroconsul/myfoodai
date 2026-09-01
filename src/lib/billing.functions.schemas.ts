import { z } from "zod";

export const inputSchema = z.object({
  planId: z.enum(["comeco", "essencial", "equipe"]),
  cycle: z.enum(["monthly", "yearly"]),
  origin: z.string().url().max(200),
});

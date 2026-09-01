import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const saveSchema = z.object({
  unitId: z.string().uuid(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(timeRegex, "Horário inválido."),
  endTime: z.string().regex(timeRegex, "Horário inválido."),
  breakStart: z.string().regex(timeRegex).nullable().optional(),
  breakEnd: z.string().regex(timeRegex).nullable().optional(),
});

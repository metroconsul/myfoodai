import { z } from "zod";

export const movementSchema = z.object({
  inventoryItemId: z.string().uuid(),
  movementType: z.enum(["entrada", "saida", "ajuste", "perda", "transferencia", "inventario"]),
  quantity: z.number().finite(),
  unitCost: z.number().finite().nullable().optional(),
  reason: z.string().trim().max(300).nullable().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  targetUnitId: z.string().uuid().nullable().optional(),
  reference: z.string().trim().max(120).nullable().optional(),
});

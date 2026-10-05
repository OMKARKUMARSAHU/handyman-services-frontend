import { z } from "zod";

export const serviceTypeIdParamsSchema = z.object({ id: z.string().uuid() });

export const createServiceTypeSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(100),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const updateServiceTypeSchema = createServiceTypeSchema.partial();

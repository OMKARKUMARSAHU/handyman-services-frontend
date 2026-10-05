import { z } from "zod";

export const categorySlugParamsSchema = z.object({ slug: z.string().min(1) });
export const categoryIdParamsSchema = z.object({ id: z.string().uuid() });

export const createCategorySchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(150),
  description: z.string().min(1),
  icon: z.string().min(1).max(100),
  image: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

import { z } from "zod";

export const productSlugParamsSchema = z.object({
  categorySlug: z.string().min(1),
  productSlug: z.string().min(1),
});
export const productIdParamsSchema = z.object({ id: z.string().uuid() });

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(150),
  description: z.string().min(1),
  icon: z.string().min(1).max(100),
  image: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();

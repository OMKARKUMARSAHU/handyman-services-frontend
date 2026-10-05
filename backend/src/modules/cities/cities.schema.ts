import { z } from "zod";

export const citySlugParamsSchema = z.object({ slug: z.string().min(1) });
export const cityIdParamsSchema = z.object({ id: z.string().uuid() });

export const listCitiesQuerySchema = z.object({
  popular: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
});

export const createCitySchema = z.object({
  name: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and hyphens only"),
  isPopular: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  iconUrl: z.string().url().nullable().optional(),
  iconAlt: z.string().max(255).nullable().optional(),
});

export const updateCitySchema = createCitySchema.partial();

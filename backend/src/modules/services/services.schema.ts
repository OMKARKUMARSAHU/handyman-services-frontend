import { z } from "zod";

export const serviceIdParamsSchema = z.object({ id: z.string().uuid() });
export const serviceSlugParamsSchema = z.object({ slug: z.string().min(1) });

export const listServicesQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  serviceTypeId: z.string().uuid().optional(),
  featured: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  mostBooked: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  sort: z.enum(["sortOrder", "name", "offerPrice"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const baseServiceSchema = z.object({
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/),
  productId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  name: z.string().min(1).max(200),
  shortDescription: z.string().min(1).max(500),
  description: z.string().min(1),
  whatsIncluded: z.array(z.string().min(1)).default([]),
  mrp: z.number().nonnegative(),
  offerPrice: z.number().nonnegative(),
  featured: z.boolean().optional(),
  isMostBooked: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const createServiceSchema = baseServiceSchema;
export const updateServiceSchema = baseServiceSchema.partial();

export const rejectListingSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const listingQueueQuerySchema = z.object({
  status: z.enum(["pending_approval", "approved", "rejected"]).optional(),
  createdByRole: z.enum(["admin", "provider"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const ownListingsQuerySchema = z.object({
  status: z.enum(["pending_approval", "approved", "rejected"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const setCityAvailabilitySchema = z.object({
  cities: z.array(z.object({ cityId: z.string().uuid(), active: z.boolean() })).min(1),
});

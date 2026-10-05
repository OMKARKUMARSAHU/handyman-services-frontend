import { z } from "zod";

export const libraryUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
});

export const createMediaSchema = z.object({
  key: z.string().min(1).max(1024),
  mimeType: z.string().min(1),
  originalFilename: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive(),
  title: z.string().max(255).optional(),
  seoTitle: z.string().max(255).optional(),
  altText: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
});

export const updateMediaSchema = z
  .object({
    title: z.string().max(255).nullable().optional(),
    seoTitle: z.string().max(255).nullable().optional(),
    altText: z.string().max(255).nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." });

export const listMediaQuerySchema = z.object({
  type: z.enum(["image", "video"]).optional(),
  search: z.string().max(255).optional(),
  activeOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const mediaIdParamsSchema = z.object({ id: z.string().uuid() });

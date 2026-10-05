import { z } from "zod";

export const uploadUrlSchema = z.object({
  serviceId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
});

export const serviceIdParamsSchema = z.object({ serviceId: z.string().uuid() });
export const imageIdParamsSchema = z.object({ id: z.string().uuid() });

export const attachImageSchema = z.object({
  key: z.string().min(1).max(1024),
  alt: z.string().min(1).max(255),
  sortOrder: z.number().int().optional(),
});

// ADMIN CMS FOLLOW-UP ("Reorder images / Set primary image"): PATCH body for
// `PATCH /media/images/:id` -- both fields optional/independent so a reorder
// (sortOrder only) and an alt-text edit (alt only) can each be a single call.
export const updateImageSchema = z
  .object({
    sortOrder: z.number().int().optional(),
    alt: z.string().min(1).max(255).optional(),
  })
  .refine((v) => v.sortOrder !== undefined || v.alt !== undefined, {
    message: "Provide at least one of sortOrder or alt.",
  });

export const cmsUploadUrlSchema = z.object({
  entityType: z.string().min(1).max(40),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
});

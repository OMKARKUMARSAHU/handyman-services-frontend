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

export const cmsUploadUrlSchema = z.object({
  entityType: z.string().min(1).max(40),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
});

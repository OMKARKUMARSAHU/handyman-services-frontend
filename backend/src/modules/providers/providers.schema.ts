import { z } from "zod";

export const updateOwnProviderSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  phone: z.string().max(20).nullable().optional(),
});

export const providerIdParamsSchema = z.object({ id: z.string().uuid() });

export const listProvidersQuerySchema = z.object({
  search: z.string().optional(),
  approvalStatus: z.enum(["pending_approval", "approved", "rejected"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const setAccountStatusSchema = z.object({
  accountStatus: z.enum(["active", "disabled"]),
});

/** Admin rejecting a pending provider application — reason is optional but shown back to the provider. */
export const rejectProviderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

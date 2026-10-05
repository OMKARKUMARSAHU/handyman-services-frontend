import { z } from "zod";

export const updateOwnCustomerSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  phone: z.string().max(20).nullable().optional(),
});

export const customerIdParamsSchema = z.object({ id: z.string().uuid() });

export const listCustomersQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const setCustomerAccountStatusSchema = z.object({
  accountStatus: z.enum(["active", "disabled"]),
});

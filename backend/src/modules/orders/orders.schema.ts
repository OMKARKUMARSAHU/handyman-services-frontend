import { z } from "zod";

export const createOrderSchema = z.object({
  addressId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "scheduledDate must be YYYY-MM-DD."),
  scheduledSlot: z.string().max(50).nullable().optional(),
  idempotencyKey: z.string().min(8).max(100),
});

export const orderIdParamsSchema = z.object({ id: z.string().uuid() });

const ORDER_STATUSES = ["pending", "confirmed", "assigned", "in_progress", "completed", "cancelled"] as const;

export const listOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  providerId: z.string().uuid().nullable().optional(),
});

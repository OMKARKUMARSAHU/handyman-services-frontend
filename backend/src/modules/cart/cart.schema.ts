import { z } from "zod";

export const addCartItemSchema = z.object({
  serviceId: z.string().uuid(),
  cityId: z.string().uuid(),
  quantity: z.number().int().positive().max(999),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(999),
});

export const cartItemIdParamsSchema = z.object({ id: z.string().uuid() });

export const mergeCartSchema = z.object({
  items: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        cityId: z.string().uuid(),
        quantity: z.number().int().positive().max(999),
      })
    )
    .max(200),
});

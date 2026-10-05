import { z } from "zod";

const pincodeSchema = z.string().trim().min(3).max(10);

export const createAddressSchema = z.object({
  label: z.string().trim().min(1).max(50),
  line1: z.string().trim().min(1).max(255),
  line2: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: pincodeSchema,
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

export const addressIdParamsSchema = z.object({ id: z.string().uuid() });

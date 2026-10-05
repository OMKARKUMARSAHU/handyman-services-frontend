import { z } from "zod";

const applicabilityType = z.enum(["all_india", "city"]);

export const listOffersQuerySchema = z.object({
  cityId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
});

export const adminListOffersQuerySchema = z.object({
  applicabilityType: applicabilityType.optional(),
  cityId: z.string().uuid().optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const offerIdParamsSchema = z.object({ id: z.string().uuid() });

const baseOfferSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().min(1),
  discountType: z.enum(["percent", "flat"]),
  discountValue: z.number().nonnegative(),
  applicabilityType,
  /** Required when applicabilityType = "city", must be omitted/null when "all_india" — see the shared refinement checks below. */
  cityId: z.string().uuid().nullable().optional(),
  appliesTo: z.object({
    scope: z.enum(["all", "category", "service"]),
    ids: z.array(z.string().uuid()),
  }),
  bannerImage: z.string().max(500).nullable().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  active: z.boolean().optional(),
});

interface OfferRefinementFields {
  applicabilityType?: "all_india" | "city";
  cityId?: string | null;
  discountType?: "percent" | "flat";
  discountValue?: number;
  startDate?: string | null;
  endDate?: string | null;
}

// Note: these schema-level checks only catch an inconsistency WITHIN a
// single request body. A PATCH that only changes one of a pair of
// interdependent fields (e.g. only `cityId`, leaving `applicabilityType`
// to its existing stored value) is still fully validated — authoritatively
// — in `offers.service.ts`'s `updateOffer()` against the merged final
// state, which is the only place that actually knows the existing row.
function checkOfferRefinements(data: OfferRefinementFields, ctx: z.RefinementCtx): void {
  if (data.applicabilityType === "all_india" && data.cityId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cityId"], message: "cityId must be omitted/null for an ALL_INDIA offer." });
  }
  if (data.applicabilityType === "city" && !data.cityId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cityId"], message: "cityId is required for a CITY offer." });
  }
  if (data.discountType === "percent" && data.discountValue !== undefined && data.discountValue > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "A percent discount cannot exceed 100." });
  }
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate must not be before startDate." });
  }
}

export const createOfferSchema = baseOfferSchema.superRefine(checkOfferRefinements);
export const updateOfferSchema = baseOfferSchema.partial().superRefine(checkOfferRefinements);

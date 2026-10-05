import type { OfferDto } from "../offers/offers.types";

export type ApprovalStatus = "pending_approval" | "approved" | "rejected";
export type CreatedByRole = "admin" | "provider";

/**
 * Public catalog shape — matches the existing frontend's `Service` type
 * (src/types/index.ts) exactly, with `mrp`/`offerPrice`/`discountPercent`/
 * `discountAmount` unchanged (PHASE 3 CORRECTION keeps these field names
 * so the existing contract never breaks) PLUS the new combined-pricing
 * fields below. `effectiveOffer`/`offerDiscountAmount`/
 * `totalDiscountAmount`/`finalPrice` are only ever resolved when the
 * request supplied a `cityId` — without one they fall back to "no offer
 * applied" (`effectiveOffer: null`, `finalPrice === offerPrice`) rather
 * than guessing which city's offer should win.
 */
export interface PublicServiceDto {
  id: string;
  slug: string;
  productId: string;
  serviceTypeId: string;
  name: string;
  shortDescription: string;
  description: string;
  whatsIncluded: string[];
  images: { id: string; serviceId: string; url: string; alt: string; sortOrder: number }[];
  mrp: number;
  offerPrice: number;
  discountPercent: number;
  discountAmount: number;
  /** The one effective Offer (CITY beats ALL_INDIA, never both) for the request's `cityId` — null when no cityId was given or none applies. */
  effectiveOffer: OfferDto | null;
  offerDiscountAmount: number;
  /** serviceDiscountAmount (mrp - offerPrice) + offerDiscountAmount, combined per the correction brief — never kept separate. */
  totalDiscountAmount: number;
  /** offerPrice minus offerDiscountAmount, floored at 0 — the actual price a customer in this city context would pay. */
  finalPrice: number;
  ratingAverage: number | null;
  ratingCount: number;
  isMostBooked: boolean;
  availableCityIds: string[];
  featured: boolean;
  active: boolean;
  sortOrder: number;
}

/** Admin/Provider management shape — adds the approval-workflow fields (PHASE_2_BACKEND_DATABASE_SCHEMA.md §9). */
export interface ManagedServiceDto extends PublicServiceDto {
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdByRole: CreatedByRole;
  createdByUserId: string;
  createdAt: string;
}

export interface ServiceRow {
  id: string;
  slug: string;
  product_id: string;
  service_type_id: string;
  name: string;
  short_description: string;
  description: string;
  whats_included: string; // JSON column comes back as a string with mysql2 unless typeCast configured
  mrp: string; // DECIMAL comes back as string from mysql2 by default
  offer_price: string;
  rating_average: string | null;
  rating_count: number;
  is_most_booked: number | boolean;
  featured: number | boolean;
  active: number | boolean;
  sort_order: number;
  approval_status: ApprovalStatus;
  rejection_reason: string | null;
  approved_by_user_id: string | null;
  approved_at: Date | string | null;
  created_by_role: CreatedByRole;
  created_by_user_id: string;
  created_at: Date | string;
}

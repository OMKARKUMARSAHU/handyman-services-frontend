import type { OfferDto } from "../offers/offers.types";

export interface CartRow {
  id: string;
  customer_id: string;
}

export interface CartItemRow {
  id: string;
  cart_id: string;
  service_id: string;
  city_id: string;
  quantity: number;
  unit_price_at_add: string;
}

export interface CartItemDto {
  id: string;
  serviceId: string;
  serviceName: string | null;
  serviceSlug: string | null;
  cityId: string;
  quantity: number;
  unitPriceAtAdd: number;
  /** Re-read from `services` at response time — null when the service no longer exists at all. */
  currentOfferPrice: number | null;
  /** true when `currentOfferPrice !== unitPriceAtAdd` — the cart's own stale-price signal (PHASE_3 brief: "changed prices"). */
  priceChanged: boolean;
  /** approved + active + offered in `cityId` right now — false covers "removed", "inactive", and "no longer available in this city" alike. */
  isAvailable: boolean;
  /** PHASE 3 CORRECTION — display-only pricing breakdown (never authoritative; order creation always recalculates from the database, see orders.service.ts). null fields mean "unavailable, no price to resolve." */
  mrp: number | null;
  serviceDiscountAmount: number;
  effectiveOffer: OfferDto | null;
  offerDiscountAmount: number;
  totalDiscountAmount: number;
  /** The per-unit price AFTER both the service's own discount and the effective Offer — what `lineTotal` is now based on. */
  finalUnitPrice: number;
  lineTotal: number;
}

export interface CartDto {
  id: string;
  customerId: string;
  items: CartItemDto[];
  /** Sum of `lineTotal` across AVAILABLE items only — an unavailable item never contributes to the total a customer would actually be charged. */
  subtotal: number;
  hasStaleItems: boolean;
}

export interface MergeSkipped {
  serviceId: string;
  cityId: string;
  reason: string;
}

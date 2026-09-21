import type { Service } from "@/types";

export interface DiscountInfo {
  discountPercent: number;
  discountAmount: number;
}

/**
 * Single source of truth for the mrp → offerPrice discount figure (see
 * PHASE_2_SYSTEM_ARCHITECTURE.md §7, PHASE_2_DATA_ARCHITECTURE.md §3 Service).
 *
 * This computes ONLY from `mrp`/`offerPrice`. It does not read or apply any
 * `Offer` record — whether a matching `Offer` stacks with, replaces, or
 * otherwise interacts with this figure is explicitly [TBD]
 * (PHASE_2_DATA_ARCHITECTURE.md §3 Offer, PHASE_2_OPEN_QUESTIONS.md #25).
 * Callers that also have an applicable Offer must display it separately
 * (see components/service/OfferTile.tsx) rather than folding it into this
 * calculation.
 */
export function computeDiscount(mrp: number, offerPrice: number): DiscountInfo {
  if (!Number.isFinite(mrp) || mrp <= 0 || !Number.isFinite(offerPrice) || offerPrice >= mrp) {
    return { discountPercent: 0, discountAmount: 0 };
  }
  const discountAmount = Math.round((mrp - offerPrice) * 100) / 100;
  const discountPercent = Math.round((discountAmount / mrp) * 100);
  return { discountPercent, discountAmount };
}

/** Applies computeDiscount to a Service record's stored mrp/offerPrice, returning it with derived fields populated. */
export function withDiscount<T extends Pick<Service, "mrp" | "offerPrice">>(
  service: T
): T & DiscountInfo {
  return { ...service, ...computeDiscount(service.mrp, service.offerPrice) };
}

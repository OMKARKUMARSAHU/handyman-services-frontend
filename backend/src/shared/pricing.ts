/**
 * Server-side port of the existing frontend's `src/lib/pricing.ts`
 * `computeDiscount()` — same inputs, same rounding, same zero-result guard.
 * This is a direct port, not a reinterpretation (PHASE_2_BACKEND_DATABASE_SCHEMA.md §10):
 * discount is derived at read time from `mrp`/`offer_price` only, never stored.
 *
 * PHASE 3 CORRECTION (supersedes the "never combined" note that used to be
 * here — Open Question #25 is now resolved, see `computeFinalPricing`
 * below): a service's own mrp/offerPrice discount DOES now combine with
 * the one effective Offer. This function's own contract is unchanged —
 * it still computes only the service-level figure — callers that also
 * have an effective Offer must go through `computeFinalPricing`, the one
 * place the two are combined.
 */

export interface DiscountInfo {
  discountPercent: number;
  discountAmount: number;
}

export function computeDiscount(mrp: number, offerPrice: number): DiscountInfo {
  if (!Number.isFinite(mrp) || mrp <= 0 || !Number.isFinite(offerPrice) || offerPrice >= mrp) {
    return { discountPercent: 0, discountAmount: 0 };
  }
  const discountAmount = Math.round((mrp - offerPrice) * 100) / 100;
  const discountPercent = Math.round((discountAmount / mrp) * 100);
  return { discountPercent, discountAmount };
}

/** Rounds a money value to 2 decimal places (matches DECIMAL(10,2) precision). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type OfferDiscountKind = "percent" | "flat";

/** The minimal shape `computeFinalPricing` needs from an effective Offer — deliberately NOT the full OfferDto, so this module stays free of any dependency on the offers module. */
export interface OfferLike {
  discountType: OfferDiscountKind;
  discountValue: number;
}

export interface PricingBreakdown {
  mrp: number;
  serviceOfferPrice: number;
  serviceDiscountPercent: number;
  serviceDiscountAmount: number;
  offerDiscountAmount: number;
  totalDiscountAmount: number;
  finalPrice: number;
}

/**
 * PHASE 3 CORRECTION — THE one place a service's own mrp/offerPrice
 * discount combines with the single effective Offer (ALL_INDIA or
 * CITY — never both; the caller resolves that down to at most one offer
 * before calling this, see `offers.service.ts`'s `resolveEffectiveOffer`/
 * `pickEffectiveOffer`). Every caller that needs a final, offer-aware
 * customer price — catalog/service-detail, cart display, and order
 * creation — goes through this single function, so the combination logic
 * is never duplicated or allowed to drift between them.
 *
 * Pipeline (matches the correction brief exactly):
 *   mrp → service offer price → service discount (display only)
 *       → offer discount, applied to the SERVICE OFFER PRICE (never mrp)
 *       → final price (floored at 0; a discount larger than the base
 *         simply consumes the whole base rather than going negative — the
 *         reported `offerDiscountAmount` is this capped amount, so
 *         `totalDiscountAmount` always reconciles exactly with
 *         `mrp - finalPrice`).
 */
export function computeFinalPricing(mrp: number, offerPrice: number, offer: OfferLike | null): PricingBreakdown {
  const { discountPercent, discountAmount } = computeDiscount(mrp, offerPrice);
  const safeOfferPrice = Number.isFinite(offerPrice) ? Math.max(offerPrice, 0) : 0;

  let offerDiscountAmount = 0;
  if (offer && safeOfferPrice > 0) {
    const raw = offer.discountType === "percent" ? safeOfferPrice * (offer.discountValue / 100) : offer.discountValue;
    offerDiscountAmount = roundMoney(Math.min(Math.max(raw, 0), safeOfferPrice));
  }

  const finalPrice = roundMoney(Math.max(safeOfferPrice - offerDiscountAmount, 0));
  const totalDiscountAmount = roundMoney(discountAmount + offerDiscountAmount);

  return {
    mrp: roundMoney(mrp),
    serviceOfferPrice: safeOfferPrice,
    serviceDiscountPercent: discountPercent,
    serviceDiscountAmount: discountAmount,
    offerDiscountAmount,
    totalDiscountAmount,
    finalPrice,
  };
}

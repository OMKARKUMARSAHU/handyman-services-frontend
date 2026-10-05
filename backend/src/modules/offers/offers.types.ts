export type OfferDiscountType = "percent" | "flat";
export type OfferScope = "all" | "category" | "service";
/** PHASE 3 CORRECTION — an Offer applies either nationwide (ALL_INDIA, `city_id` NULL) or to exactly one city (CITY, `city_id` required). Enforced by a DB CHECK constraint (migration 000012), never just application code. */
export type OfferApplicabilityType = "all_india" | "city";

export interface OfferRow {
  id: string;
  title: string;
  description: string;
  discount_type: OfferDiscountType;
  discount_value: string;
  applies_to_scope: OfferScope;
  applies_to_ids: string; // JSON column — string with mysql2 unless typeCast configured
  applicability_type: OfferApplicabilityType;
  city_id: string | null;
  banner_image: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  active: boolean | number;
  created_at: string | Date;
  /** Strictly-increasing auto-increment tie-breaker — see migration 000012's doc comment. Used ONLY for deterministic "most recently created" resolution, never exposed on the DTO. */
  seq: number;
}

export interface OfferDto {
  id: string;
  title: string;
  description: string;
  discountType: OfferDiscountType;
  discountValue: number;
  applicabilityType: OfferApplicabilityType;
  cityId: string | null;
  appliesTo: { scope: OfferScope; ids: string[] };
  bannerImage: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}

export function toDateOnly(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

export function parseIds(value: string): string[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toOfferDto(row: OfferRow): OfferDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    applicabilityType: row.applicability_type,
    cityId: row.city_id,
    appliesTo: { scope: row.applies_to_scope, ids: parseIds(row.applies_to_ids) },
    bannerImage: row.banner_image,
    startDate: toDateOnly(row.start_date),
    endDate: toDateOnly(row.end_date),
    active: Boolean(row.active),
  };
}

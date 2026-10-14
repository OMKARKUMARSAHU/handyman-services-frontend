/**
 * Pure helpers for the Admin "City-wise Pricing" section of the service form
 * (no React, no network) so the rules are easy to read and test:
 *
 * - an EMPTY price field means "use the service's base price" (never zero);
 * - a city's MRP and offer price are entered together (both or neither);
 * - each must be a non-negative number and the offer price may not exceed
 *   the MRP — the same rules the backend enforces (`setCityPricingSchema`
 *   and the database CHECK constraints), checked here only so the admin gets
 *   an immediate, per-city message instead of a failed save.
 */

export interface CityRowState {
  /** Mirrors the existing city-availability setting (service_city_availability.active). */
  available: boolean;
  /** Raw input text; "" = no custom price. */
  mrp: string;
  offerPrice: string;
}

export type CityRows = Record<string, CityRowState>;

export interface CityPriceInput {
  cityId: string;
  mrp: number | null;
  offerPrice: number | null;
}

export interface ServiceCitySource {
  availableCityIds: string[];
  cityPrices?: { cityId: string; mrp: number; offerPrice: number }[];
}

export function buildInitialRows(cityIds: string[], source: ServiceCitySource | null): CityRows {
  const available = new Set(source?.availableCityIds ?? []);
  const prices = new Map((source?.cityPrices ?? []).map((p) => [p.cityId, p]));
  const rows: CityRows = {};
  for (const id of cityIds) {
    const p = prices.get(id);
    rows[id] = { available: available.has(id), mrp: p ? String(p.mrp) : "", offerPrice: p ? String(p.offerPrice) : "" };
  }
  return rows;
}

function parsePrice(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Returns a message when this row's prices are invalid, otherwise null. Empty/empty is valid ("use base"). */
export function validateRow(row: CityRowState): string | null {
  const mrp = parsePrice(row.mrp);
  const offer = parsePrice(row.offerPrice);
  if (mrp === null && offer === null) return null;
  if (mrp === null || offer === null) return "Enter both MRP and offer price, or clear both to use the base price.";
  if (Number.isNaN(mrp) || Number.isNaN(offer)) return "Prices must be numbers.";
  if (mrp < 0 || offer < 0) return "Prices cannot be negative.";
  if (offer > mrp) return "Offer price cannot exceed MRP.";
  return null;
}

export function validateRows(rows: CityRows): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [cityId, row] of Object.entries(rows)) {
    const message = validateRow(row);
    if (message) errors[cityId] = message;
  }
  return errors;
}

function priceKey(row: CityRowState): string {
  const mrp = parsePrice(row.mrp);
  const offer = parsePrice(row.offerPrice);
  return mrp === null && offer === null ? "" : `${mrp}|${offer}`;
}

export interface CityChanges {
  availability: { cityId: string; active: boolean }[];
  pricing: CityPriceInput[];
}

/**
 * Only what the admin actually changed is sent: availability entries whose
 * checkbox differs from the loaded state, and price entries whose (mrp, offer)
 * differ from the loaded state (a cleared pair becomes null/null). Untouched
 * cities are never re-saved, so editing one city cannot disturb another.
 * Call `validateRows` first — this assumes every row is valid.
 */
export function diffRows(initial: CityRows, current: CityRows): CityChanges {
  const changes: CityChanges = { availability: [], pricing: [] };
  for (const [cityId, row] of Object.entries(current)) {
    const before = initial[cityId] ?? { available: false, mrp: "", offerPrice: "" };
    if (row.available !== before.available) changes.availability.push({ cityId, active: row.available });
    if (priceKey(row) !== priceKey(before)) {
      const mrp = parsePrice(row.mrp);
      const offer = parsePrice(row.offerPrice);
      changes.pricing.push(mrp === null || offer === null ? { cityId, mrp: null, offerPrice: null } : { cityId, mrp, offerPrice: offer });
    }
  }
  return changes;
}

export function hasCustomPrice(row: CityRowState): boolean {
  return row.mrp.trim() !== "" || row.offerPrice.trim() !== "";
}

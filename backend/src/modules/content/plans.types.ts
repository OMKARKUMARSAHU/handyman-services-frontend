export interface PlanRow {
  id: string;
  name: string;
  price: string;
  currency: string;
  billing_period: string;
  description: string;
  visits: number;
  appliance_count: string;
  appliance_ids: string; // JSON column
  features: string; // JSON column
  badge: string | null;
  cta_text: string;
  available: boolean | number;
  sort_order: number;
  price_confirmed: boolean | number;
}

export interface PlanDto {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: string;
  description: string;
  visits: number;
  applianceCount: number | "all";
  applianceIds: string[] | "all";
  features: string[];
  badge: string | null;
  ctaText: string;
  available: boolean;
  sortOrder: number;
  priceConfirmed: boolean;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function toPlanDto(row: PlanRow): PlanDto {
  const applianceCount = row.appliance_count === "all" ? "all" : Number(row.appliance_count);
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    currency: row.currency,
    billingPeriod: row.billing_period,
    description: row.description,
    visits: row.visits,
    applianceCount,
    applianceIds: parseJson<string[] | "all">(row.appliance_ids, []),
    features: parseJson<string[]>(row.features, []),
    badge: row.badge,
    ctaText: row.cta_text,
    available: Boolean(row.available),
    sortOrder: row.sort_order,
    priceConfirmed: Boolean(row.price_confirmed),
  };
}

import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import { getDb } from "../../database/db";
import { NotFoundError, ValidationError } from "../../shared/errors";
import type { PaginationParams } from "../../shared/response";
import {
  parseIds,
  toDateOnly,
  toOfferDto,
  type OfferApplicabilityType,
  type OfferDto,
  type OfferDiscountType,
  type OfferRow,
  type OfferScope,
} from "./offers.types";

const TABLE = "offers";

/**
 * Deliberately queries `services`/`categories` directly (not through those
 * modules' own service files) so this module has ZERO import dependency on
 * `services.service.ts` — which itself depends on this module (for
 * `resolveEffectiveOffer`/`getActiveOffersForCity`/`pickEffectiveOffer`) to
 * price a catalog listing. Importing either direction would create a
 * circular dependency; this keeps the dependency graph one-way.
 */
async function assertAppliesToTargetsExist(scope: OfferScope, ids: string[]): Promise<void> {
  if (scope === "all" || ids.length === 0) return;
  const table = scope === "service" ? "services" : "categories";
  const rows = await getDb()(table).whereIn("id", ids).select<{ id: string }[]>("id");
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new ValidationError(`appliesTo.ids references unknown ${scope} id(s): ${missing.join(", ")}`);
  }
}

async function assertApplicabilityValid(type: OfferApplicabilityType, cityId: string | null | undefined): Promise<void> {
  if (type === "all_india") {
    if (cityId) throw new ValidationError("An ALL_INDIA offer must not have a cityId.");
    return;
  }
  if (!cityId) throw new ValidationError("A CITY offer requires a cityId.");
  const city = await getDb()("cities").where({ id: cityId }).first();
  if (!city) throw new ValidationError("cityId does not reference an existing city.");
}

function assertDiscountValid(type: OfferDiscountType, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new ValidationError("discountValue must be a non-negative number.");
  if (type === "percent" && value > 100) throw new ValidationError("A percent discount cannot exceed 100.");
}

function assertDateRangeValid(start?: string | null, end?: string | null): void {
  if (start && end && start > end) throw new ValidationError("endDate must not be before startDate.");
}

/** Pure, in-memory scope match — the ONE place "does this Offer apply to this service/category" is decided, shared by the public listing, the admin listing's own filters, and effective-offer resolution so the rule can never drift between them. */
export function offerMatchesScope(row: OfferRow, ctx: { serviceId?: string | null; categoryId?: string | null }): boolean {
  if (row.applies_to_scope === "all") return true;
  if (row.applies_to_scope === "service") {
    return Boolean(ctx.serviceId) && parseIds(row.applies_to_ids).includes(ctx.serviceId!);
  }
  if (row.applies_to_scope === "category") {
    return Boolean(ctx.categoryId) && parseIds(row.applies_to_ids).includes(ctx.categoryId!);
  }
  return false;
}

function activeInRange<TResult>(query: Knex.QueryBuilder<OfferRow, TResult>): Knex.QueryBuilder<OfferRow, TResult> {
  const today = new Date().toISOString().slice(0, 10);
  return query
    .where({ active: true })
    .andWhere((b) => b.whereNull("start_date").orWhere("start_date", "<=", today))
    .andWhere((b) => b.whereNull("end_date").orWhere("end_date", ">=", today));
}

/** `seq` (a plain auto-increment counter — see migration 000012) rather than `created_at`: two offers created within the same second would otherwise tie, since `created_at` is only second-precision. `seq` can never tie. */
function sortNewestFirst(rows: OfferRow[]): OfferRow[] {
  return [...rows].sort((a, b) => b.seq - a.seq);
}

export interface OfferPool {
  /** Active, in-date-range, `applicability_type = 'city'` offers for exactly the requested city. Empty when `cityId` is null. */
  cityOffers: OfferRow[];
  /** Active, in-date-range, `applicability_type = 'all_india'` offers. */
  allIndiaOffers: OfferRow[];
}

/**
 * Fetches the full candidate pool for a city ONCE (two queries, regardless
 * of how many services are being priced) — callers that need to price many
 * services for the same city (catalog listing) call this once and reuse
 * the pool via `pickEffectiveOffer`, rather than re-querying per service.
 */
export async function getActiveOffersForCity(cityId: string | null): Promise<OfferPool> {
  const [allIndiaOffers, cityOffers] = await Promise.all([
    activeInRange(getDb()<OfferRow>(TABLE).where({ applicability_type: "all_india" })),
    cityId ? activeInRange(getDb()<OfferRow>(TABLE).where({ applicability_type: "city", city_id: cityId })) : Promise.resolve([]),
  ]);
  return { cityOffers, allIndiaOffers };
}

/**
 * FINAL OFFER PRIORITY RULE: a CITY offer matching this service/category
 * always wins over an ALL_INDIA offer — never both, never stacked. Within
 * a single tier, if more than one Offer matches (an ambiguous admin
 * configuration), the most-recently-created one wins — a documented,
 * deterministic tie-break rather than silent stacking or an arbitrary
 * database row order.
 */
export function pickEffectiveOffer(pool: OfferPool, ctx: { serviceId: string; categoryId: string | null }): OfferDto | null {
  const cityMatches = pool.cityOffers.filter((row) => offerMatchesScope(row, ctx));
  if (cityMatches.length > 0) return toOfferDto(sortNewestFirst(cityMatches)[0]!);

  const allIndiaMatches = pool.allIndiaOffers.filter((row) => offerMatchesScope(row, ctx));
  if (allIndiaMatches.length > 0) return toOfferDto(sortNewestFirst(allIndiaMatches)[0]!);

  return null;
}

/** Convenience wrapper for single-item lookups (a cart item, an order line, one service's detail page) — two queries plus the in-memory pick, same deterministic rule as the batch path. */
export async function resolveEffectiveOffer(
  cityId: string,
  serviceId: string,
  categoryId: string | null
): Promise<OfferDto | null> {
  const pool = await getActiveOffersForCity(cityId);
  return pickEffectiveOffer(pool, { serviceId, categoryId });
}

export interface PublicOfferFilters {
  /** When given, the result is ALL_INDIA offers UNION CITY offers for exactly this city — never another city's CITY offer. When omitted, only ALL_INDIA offers are returned (a CITY offer is never "applicable" without a city context). */
  cityId?: string;
  serviceId?: string;
  categoryId?: string;
}

/** Active, currently-in-date-range offers applicable to the given city context (see `PublicOfferFilters.cityId`); when `serviceId`/`categoryId` are given, an offer must be scoped to `all` or explicitly reference that id. */
export async function listOffersPublic(filters: PublicOfferFilters): Promise<OfferDto[]> {
  const pool = await getActiveOffersForCity(filters.cityId ?? null);
  const candidates = filters.cityId ? [...pool.cityOffers, ...pool.allIndiaOffers] : pool.allIndiaOffers;

  const scoped =
    filters.serviceId || filters.categoryId
      ? candidates.filter((row) => offerMatchesScope(row, { serviceId: filters.serviceId, categoryId: filters.categoryId }))
      : candidates;

  return sortNewestFirst(scoped).map(toOfferDto);
}

export interface AdminOfferFilters {
  applicabilityType?: OfferApplicabilityType;
  cityId?: string;
  active?: boolean;
}

/** Admin-only, unrestricted listing (every city, active or not) — fulfils the correction brief's explicit "Admin must be able to READ offers" requirement, which the public, city-scoped `GET /offers` cannot serve on its own. */
export async function listOffersAdmin(
  filters: AdminOfferFilters,
  pagination: PaginationParams
): Promise<{ items: OfferDto[]; total: number }> {
  let query = getDb()<OfferRow>(TABLE);
  if (filters.applicabilityType) query = query.andWhere({ applicability_type: filters.applicabilityType });
  if (filters.cityId) query = query.andWhere({ city_id: filters.cityId });
  if (filters.active !== undefined) query = query.andWhere({ active: filters.active });

  const countRow = await query.clone().count<{ count: string }[]>("id as count").first();
  const total = Number(countRow?.count ?? 0);

  const rows = await query
    .clone()
    .orderBy("seq", "desc")
    .offset((pagination.page - 1) * pagination.pageSize)
    .limit(pagination.pageSize);

  return { items: rows.map(toOfferDto), total };
}

export async function getOfferById(id: string): Promise<OfferDto | null> {
  const row = await getDb()<OfferRow>(TABLE).where({ id }).first();
  return row ? toOfferDto(row) : null;
}

export interface UpsertOfferInput {
  title: string;
  description: string;
  discountType: OfferDiscountType;
  discountValue: number;
  applicabilityType: OfferApplicabilityType;
  /** Required when `applicabilityType === "city"`, must be omitted/null when `"all_india"` — enforced both here and by the DB CHECK constraint. */
  cityId?: string | null;
  appliesTo: { scope: OfferScope; ids: string[] };
  bannerImage?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
}

export async function createOffer(input: UpsertOfferInput): Promise<OfferDto> {
  await assertApplicabilityValid(input.applicabilityType, input.cityId ?? null);
  assertDiscountValid(input.discountType, input.discountValue);
  assertDateRangeValid(input.startDate, input.endDate);
  await assertAppliesToTargetsExist(input.appliesTo.scope, input.appliesTo.ids);

  const id = randomUUID();
  await getDb()<OfferRow>(TABLE).insert({
    id,
    title: input.title,
    description: input.description,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    applies_to_scope: input.appliesTo.scope,
    applies_to_ids: JSON.stringify(input.appliesTo.ids),
    applicability_type: input.applicabilityType,
    city_id: input.applicabilityType === "city" ? input.cityId ?? null : null,
    banner_image: input.bannerImage ?? null,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    active: input.active ?? true,
  } as unknown as OfferRow);
  const created = await getOfferById(id);
  if (!created) throw new Error("Failed to read back created offer.");
  return created;
}

export async function updateOffer(id: string, input: Partial<UpsertOfferInput>): Promise<OfferDto> {
  const existing = await getDb()<OfferRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Offer not found.");

  const nextApplicabilityType = input.applicabilityType ?? existing.applicability_type;
  const nextCityId = input.cityId !== undefined ? input.cityId : existing.city_id;
  await assertApplicabilityValid(nextApplicabilityType, nextCityId);

  const nextDiscountType = input.discountType ?? existing.discount_type;
  const nextDiscountValue = input.discountValue ?? Number(existing.discount_value);
  assertDiscountValid(nextDiscountType, nextDiscountValue);

  const nextStart = input.startDate !== undefined ? input.startDate : toDateOnly(existing.start_date);
  const nextEnd = input.endDate !== undefined ? input.endDate : toDateOnly(existing.end_date);
  assertDateRangeValid(nextStart, nextEnd);

  if (input.appliesTo !== undefined) {
    await assertAppliesToTargetsExist(input.appliesTo.scope, input.appliesTo.ids);
  }

  const patch: Partial<OfferRow> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.discountType !== undefined) patch.discount_type = input.discountType;
  if (input.discountValue !== undefined) patch.discount_value = input.discountValue as unknown as string;
  if (input.appliesTo !== undefined) {
    patch.applies_to_scope = input.appliesTo.scope;
    patch.applies_to_ids = JSON.stringify(input.appliesTo.ids) as unknown as string;
  }
  if (input.applicabilityType !== undefined || input.cityId !== undefined) {
    patch.applicability_type = nextApplicabilityType;
    patch.city_id = nextApplicabilityType === "city" ? nextCityId ?? null : null;
  }
  if (input.bannerImage !== undefined) patch.banner_image = input.bannerImage;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length > 0) {
    await getDb()<OfferRow>(TABLE).where({ id }).update(patch);
  }
  const updated = await getOfferById(id);
  if (!updated) throw new Error("Failed to read back updated offer.");
  return updated;
}

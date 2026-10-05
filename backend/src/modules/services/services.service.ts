import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import { getDb } from "../../database/db";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { buildPageMeta, type PaginationParams } from "../../shared/response";
import { getActiveOffersForCity, pickEffectiveOffer, resolveEffectiveOffer } from "../offers/offers.service";
import { toManagedServiceDto, toPublicServiceDto, type ServiceImageRow } from "./services.mappers";
import type { ApprovalStatus, CreatedByRole, ManagedServiceDto, PublicServiceDto, ServiceRow } from "./services.types";

const TABLE = "services";
const IMAGES_TABLE = "service_images";
const AVAILABILITY_TABLE = "service_city_availability";

/** PHASE_2_BACKEND_DATABASE_SCHEMA.md §9 — every public/customer-facing catalog query. */
function publicVisibilityFilter<TResult>(
  query: Knex.QueryBuilder<ServiceRow, TResult>
): Knex.QueryBuilder<ServiceRow, TResult> {
  return query.where({ [`${TABLE}.approval_status`]: "approved", [`${TABLE}.active`]: true } as never);
}

async function imagesFor(serviceIds: string[]): Promise<Map<string, ServiceImageRow[]>> {
  if (serviceIds.length === 0) return new Map();
  const rows = await getDb()<ServiceImageRow>(IMAGES_TABLE).whereIn("service_id", serviceIds);
  const map = new Map<string, ServiceImageRow[]>();
  for (const row of rows) {
    const list = map.get(row.service_id) ?? [];
    list.push(row);
    map.set(row.service_id, list);
  }
  return map;
}

interface AvailabilityRow {
  service_id: string;
  city_id: string;
  active: boolean | number;
}

async function availableCityIdsFor(serviceIds: string[]): Promise<Map<string, string[]>> {
  if (serviceIds.length === 0) return new Map();
  const rows = await getDb()<AvailabilityRow>(AVAILABILITY_TABLE)
    .whereIn("service_id", serviceIds)
    .andWhere({ active: true });
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.service_id) ?? [];
    list.push(row.city_id);
    map.set(row.service_id, list);
  }
  return map;
}

interface ServiceCategoryRow {
  service_id: string;
  category_id: string;
}

/** Batch version of `getServiceCategoryId` for the catalog-list path — one query regardless of result-set size, same pattern as `imagesFor`/`availableCityIdsFor`. */
async function categoryIdsFor(serviceIds: string[]): Promise<Map<string, string>> {
  if (serviceIds.length === 0) return new Map();
  const rows = await getDb()(TABLE)
    .join("products", "products.id", `${TABLE}.product_id`)
    .whereIn(`${TABLE}.id`, serviceIds)
    .select<ServiceCategoryRow[]>(`${TABLE}.id as service_id`, "products.category_id as category_id");
  return new Map(rows.map((r) => [r.service_id, r.category_id]));
}

/** Single-service lookup for the detail-page / cart / order paths — joins through the service's product to its category, needed for Offer scope matching (`appliesTo.scope = "category"`). */
export async function getServiceCategoryId(serviceId: string): Promise<string | null> {
  const row = await getDb()(TABLE)
    .join("products", "products.id", `${TABLE}.product_id`)
    .where(`${TABLE}.id`, serviceId)
    .first<ServiceCategoryRow | undefined>(`${TABLE}.id as service_id`, "products.category_id as category_id");
  return row?.category_id ?? null;
}

export interface PublicServiceFilters {
  productId?: string;
  categoryId?: string;
  cityId?: string;
  serviceTypeId?: string;
  featured?: boolean;
  mostBooked?: boolean;
  /** Case-insensitive substring match on `name` — used by the `/search` endpoint (services.mappers stays untouched; this is the only extra filter it needs). */
  q?: string;
  sort?: "sortOrder" | "name" | "offerPrice";
  order?: "asc" | "desc";
}

export async function listServicesPublic(
  filters: PublicServiceFilters,
  pagination: PaginationParams
): Promise<{ items: PublicServiceDto[]; total: number }> {
  const db = getDb();

  let base = db<ServiceRow>(TABLE);
  base = publicVisibilityFilter(base);

  if (filters.productId) base = base.andWhere(`${TABLE}.product_id`, filters.productId);
  if (filters.serviceTypeId) base = base.andWhere(`${TABLE}.service_type_id`, filters.serviceTypeId);
  if (filters.featured) base = base.andWhere(`${TABLE}.featured`, true);
  if (filters.mostBooked) base = base.andWhere(`${TABLE}.is_most_booked`, true);
  if (filters.q) base = base.andWhere((b) => b.whereILike(`${TABLE}.name`, `%${filters.q}%`));
  if (filters.categoryId) {
    base = base
      .join("products", "products.id", `${TABLE}.product_id`)
      .andWhere("products.category_id", filters.categoryId);
  }
  if (filters.cityId) {
    base = base
      .join(`${AVAILABILITY_TABLE} as sca`, function joinAvailability() {
        this.on("sca.service_id", `${TABLE}.id`).andOn("sca.active", db.raw("true"));
      })
      .andWhere("sca.city_id", filters.cityId);
  }

  const countRow = await base.clone().clearSelect().count<{ count: string }[]>(`${TABLE}.id as count`).first();
  const total = Number(countRow?.count ?? 0);

  const sortColumn =
    filters.sort === "name" ? "name" : filters.sort === "offerPrice" ? "offer_price" : "sort_order";
  const rows = await base
    .clone()
    .select(`${TABLE}.*`)
    .distinct(`${TABLE}.id`)
    .orderBy(`${TABLE}.${sortColumn}`, filters.order ?? "asc")
    .offset((pagination.page - 1) * pagination.pageSize)
    .limit(pagination.pageSize);

  const ids = rows.map((r) => r.id);
  const [imagesMap, cityMap] = await Promise.all([imagesFor(ids), availableCityIdsFor(ids)]);

  // Pricing is only resolved city-aware when a cityId was actually given —
  // without one there is no city context to pick a CITY offer over an
  // ALL_INDIA one, so every item falls back to its plain service price
  // (effectiveOffer: null) rather than guessing. One offer-pool fetch
  // covers the whole page, never one query per service (PHASE 3
  // CORRECTION — see offers.service.ts's getActiveOffersForCity).
  let offerPool: Awaited<ReturnType<typeof getActiveOffersForCity>> | null = null;
  let categoryMap = new Map<string, string>();
  if (filters.cityId) {
    [offerPool, categoryMap] = await Promise.all([getActiveOffersForCity(filters.cityId), categoryIdsFor(ids)]);
  }

  return {
    items: rows.map((row) => {
      const offer = offerPool
        ? pickEffectiveOffer(offerPool, { serviceId: row.id, categoryId: categoryMap.get(row.id) ?? null })
        : null;
      return toPublicServiceDto(row, imagesMap.get(row.id) ?? [], cityMap.get(row.id) ?? [], offer);
    }),
    total,
  };
}

export async function getServiceBySlugPublic(slug: string, cityId?: string): Promise<PublicServiceDto | null> {
  const query = publicVisibilityFilter(getDb()<ServiceRow>(TABLE)).andWhere({ slug });
  const row = await query.first();
  if (!row) return null;

  const cityIds = (await availableCityIdsFor([row.id])).get(row.id) ?? [];
  if (cityId && !cityIds.includes(cityId)) return null;

  const images = (await imagesFor([row.id])).get(row.id) ?? [];

  let offer = null;
  if (cityId) {
    const categoryId = await getServiceCategoryId(row.id);
    offer = await resolveEffectiveOffer(cityId, row.id, categoryId);
  }

  return toPublicServiceDto(row, images, cityIds, offer);
}

async function toManagedById(id: string): Promise<ManagedServiceDto | null> {
  const row = await getDb()<ServiceRow>(TABLE).where({ id }).first();
  if (!row) return null;
  const images = (await imagesFor([id])).get(id) ?? [];
  const cityIds = (await availableCityIdsFor([id])).get(id) ?? [];
  return toManagedServiceDto(row, images, cityIds);
}

export async function getManagedServiceById(id: string): Promise<ManagedServiceDto | null> {
  return toManagedById(id);
}

/** Used by requireOwnership() — returns the Cognito sub of the listing's creator, or null if it doesn't exist. */
export async function getServiceOwnerSub(id: string): Promise<string | null> {
  const row = await getDb()<Pick<ServiceRow, "id" | "created_by_user_id">>(TABLE)
    .where({ id })
    .first("created_by_user_id");
  return row?.created_by_user_id ?? null;
}

/**
 * Raw row access for modules (cart, orders) that need the authoritative
 * `mrp`/`offer_price`/`approval_status`/`active` fields directly — never
 * the frontend-shaped DTO — to re-derive pricing and visibility themselves
 * at cart/checkout time rather than trusting anything the client submitted.
 */
export async function getServiceRowById(id: string): Promise<ServiceRow | null> {
  const row = await getDb()<ServiceRow>(TABLE).where({ id }).first();
  return row ?? null;
}

/** True only when the service is currently approved+active AND actively offered in that city — the exact rule `publicVisibilityFilter` + the city-availability join enforce for catalog browsing, reused here so cart/order validation can never drift from what a customer is shown. */
export async function isServicePurchasableInCity(serviceId: string, cityId: string): Promise<boolean> {
  const row = await getDb()<ServiceRow>(TABLE).where({ id: serviceId, approval_status: "approved", active: true }).first();
  if (!row) return false;
  const availability = await getDb()(AVAILABILITY_TABLE)
    .where({ service_id: serviceId, city_id: cityId, active: true })
    .first();
  return Boolean(availability);
}

export interface CreateServiceInput {
  slug: string;
  productId: string;
  serviceTypeId: string;
  name: string;
  shortDescription: string;
  description: string;
  whatsIncluded: string[];
  mrp: number;
  offerPrice: number;
  featured?: boolean;
  isMostBooked?: boolean;
  active?: boolean;
  sortOrder?: number;
}

/**
 * Both Admin and Provider creation go through this ONE function and both
 * ALWAYS start `pending_approval` — the Phase 3 brief's explicit, final
 * instruction ("Do not automatically publish Admin-created listings").
 * There is no second, Admin-only "publish immediately" path.
 */
export async function createService(
  input: CreateServiceInput,
  createdByRole: CreatedByRole,
  createdByUserId: string
): Promise<ManagedServiceDto> {
  if (input.offerPrice > input.mrp) {
    throw new ConflictError("offerPrice cannot exceed mrp.");
  }
  const id = randomUUID();
  await getDb()<ServiceRow>(TABLE).insert({
    id,
    slug: input.slug,
    product_id: input.productId,
    service_type_id: input.serviceTypeId,
    name: input.name,
    short_description: input.shortDescription,
    description: input.description,
    whats_included: JSON.stringify(input.whatsIncluded),
    mrp: input.mrp,
    offer_price: input.offerPrice,
    rating_average: null,
    rating_count: 0,
    is_most_booked: input.isMostBooked ?? false,
    featured: input.featured ?? false,
    active: input.active ?? true,
    sort_order: input.sortOrder ?? 0,
    approval_status: "pending_approval",
    rejection_reason: null,
    approved_by_user_id: null,
    approved_at: null,
    created_by_role: createdByRole,
    created_by_user_id: createdByUserId,
  } as unknown as ServiceRow);

  const createdRow = await toManagedById(id);
  if (!createdRow) throw new Error("Failed to read back created service.");
  return createdRow;
}

export type UpdateServiceInput = Partial<CreateServiceInput>;

/**
 * Edit policy (an explicit, documented implementation decision — Phase 2
 * left "editing an approved listing" as `TBD`, Open Question #27; this is
 * the concrete rule Phase 3 needed to ship something coherent, and is
 * flagged in PHASE_3_BACKEND_IMPLEMENTATION.md as needing client
 * confirmation, not silently assumed):
 *
 * - A Provider editing their OWN listing while it is `approved` moves it
 *   back to `pending_approval` — a Provider is never allowed to publish a
 *   change directly (the brief's explicit "Provider CANNOT... publish
 *   directly"), so an edited-and-still-live listing would be exactly that.
 * - An Admin editing ANY listing (their own or a Provider's) never forces a
 *   requeue — Admin already holds approval authority over every listing in
 *   the one shared queue, so gating their own edits behind their own
 *   approval click would be pure friction with no additional safety.
 * - Editing a `rejected` listing (either role) returns it to
 *   `pending_approval`, giving the Provider a path back in, per the
 *   approval design (PHASE_2_BACKEND_DATABASE_SCHEMA.md §9).
 */
export async function updateService(
  id: string,
  input: UpdateServiceInput,
  actor: { role: CreatedByRole; sub: string }
): Promise<ManagedServiceDto> {
  const existing = await getDb()<ServiceRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Service not found.");

  const nextMrp = input.mrp ?? Number(existing.mrp);
  const nextOfferPrice = input.offerPrice ?? Number(existing.offer_price);
  if (nextOfferPrice > nextMrp) {
    throw new ConflictError("offerPrice cannot exceed mrp.");
  }

  const patch: Partial<ServiceRow> = {};
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.productId !== undefined) patch.product_id = input.productId;
  if (input.serviceTypeId !== undefined) patch.service_type_id = input.serviceTypeId;
  if (input.name !== undefined) patch.name = input.name;
  if (input.shortDescription !== undefined) patch.short_description = input.shortDescription;
  if (input.description !== undefined) patch.description = input.description;
  if (input.whatsIncluded !== undefined) patch.whats_included = JSON.stringify(input.whatsIncluded) as unknown as string;
  if (input.mrp !== undefined) patch.mrp = input.mrp as unknown as string;
  if (input.offerPrice !== undefined) patch.offer_price = input.offerPrice as unknown as string;
  if (input.featured !== undefined) patch.featured = input.featured;
  if (input.isMostBooked !== undefined) patch.is_most_booked = input.isMostBooked;
  if (input.active !== undefined) patch.active = input.active;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const currentStatus: ApprovalStatus = existing.approval_status;
  if (currentStatus === "rejected") {
    patch.approval_status = "pending_approval";
    patch.rejection_reason = null;
    patch.approved_by_user_id = null;
    patch.approved_at = null;
  } else if (currentStatus === "approved" && actor.role === "provider") {
    patch.approval_status = "pending_approval";
    patch.approved_by_user_id = null;
    patch.approved_at = null;
  }
  // approved + actor.role === "admin" → no status change (see doc comment above).
  // pending_approval → stays pending_approval regardless of actor.

  if (Object.keys(patch).length > 0) {
    await getDb()<ServiceRow>(TABLE).where({ id }).update(patch);
  }
  const updated = await toManagedById(id);
  if (!updated) throw new Error("Failed to read back updated service.");
  return updated;
}

export interface ListingQueueFilters {
  status?: ApprovalStatus;
  createdByRole?: CreatedByRole;
}

/** The ONE shared Admin approval queue — both Provider-created and Admin-created listings, never split (Phase 3 brief §5, "there is NO second approver, no separate approval systems"). */
export async function listApprovalQueue(
  filters: ListingQueueFilters,
  pagination: PaginationParams
): Promise<{ items: ManagedServiceDto[]; total: number; meta: ReturnType<typeof buildPageMeta> }> {
  let query = getDb()<ServiceRow>(TABLE);
  if (filters.status) query = query.andWhere({ approval_status: filters.status });
  if (filters.createdByRole) query = query.andWhere({ created_by_role: filters.createdByRole });

  const countRow = await query.clone().count<{ count: string }[]>("id as count").first();
  const total = Number(countRow?.count ?? 0);

  const rows = await query
    .clone()
    .orderBy("created_at", "asc")
    .offset((pagination.page - 1) * pagination.pageSize)
    .limit(pagination.pageSize);

  const ids = rows.map((r) => r.id);
  const [imagesMap, cityMap] = await Promise.all([imagesFor(ids), availableCityIdsFor(ids)]);
  const items = rows.map((row) => toManagedServiceDto(row, imagesMap.get(row.id) ?? [], cityMap.get(row.id) ?? []));
  return { items, total, meta: buildPageMeta(pagination, total) };
}

export async function listOwnListings(
  createdByUserId: string,
  filters: { status?: ApprovalStatus },
  pagination: PaginationParams
): Promise<{ items: ManagedServiceDto[]; total: number }> {
  let query = getDb()<ServiceRow>(TABLE).where({ created_by_user_id: createdByUserId });
  if (filters.status) query = query.andWhere({ approval_status: filters.status });

  const countRow = await query.clone().count<{ count: string }[]>("id as count").first();
  const total = Number(countRow?.count ?? 0);

  const rows = await query
    .clone()
    .orderBy("created_at", "desc")
    .offset((pagination.page - 1) * pagination.pageSize)
    .limit(pagination.pageSize);

  const ids = rows.map((r) => r.id);
  const [imagesMap, cityMap] = await Promise.all([imagesFor(ids), availableCityIdsFor(ids)]);
  return {
    items: rows.map((row) => toManagedServiceDto(row, imagesMap.get(row.id) ?? [], cityMap.get(row.id) ?? [])),
    total,
  };
}

export async function approveListing(id: string, approverSub: string): Promise<ManagedServiceDto> {
  const existing = await getDb()<ServiceRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Listing not found.");
  if (existing.approval_status !== "pending_approval") {
    throw new ConflictError(`Cannot approve a listing with status "${existing.approval_status}" — it must be pending_approval.`);
  }
  await getDb()<ServiceRow>(TABLE)
    .where({ id })
    .update({
      approval_status: "approved",
      approved_by_user_id: approverSub,
      approved_at: new Date(),
      rejection_reason: null,
    });
  const updated = await toManagedById(id);
  if (!updated) throw new Error("Failed to read back approved listing.");
  return updated;
}

export async function rejectListing(id: string, approverSub: string, reason: string): Promise<ManagedServiceDto> {
  const existing = await getDb()<ServiceRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Listing not found.");
  if (existing.approval_status !== "pending_approval") {
    throw new ConflictError(`Cannot reject a listing with status "${existing.approval_status}" — it must be pending_approval.`);
  }
  await getDb()<ServiceRow>(TABLE)
    .where({ id })
    .update({
      approval_status: "rejected",
      rejection_reason: reason,
      approved_by_user_id: approverSub,
      approved_at: new Date(),
    });
  const updated = await toManagedById(id);
  if (!updated) throw new Error("Failed to read back rejected listing.");
  return updated;
}

/** Used by the Provider-ownership guard: only the creating Provider (never another Provider, never by virtue of being ANY provider) may edit. Admin bypasses this via requireRole("admin") on its own routes instead. */
export function assertProviderOwnsOrThrow(service: ManagedServiceDto, providerSub: string): void {
  if (service.createdByRole !== "provider" || service.createdByUserId !== providerSub) {
    throw new ForbiddenError("You do not own this listing.");
  }
}

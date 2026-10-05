import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import { getDb } from "../../database/db";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { computeFinalPricing } from "../../shared/pricing";
import { resolveEffectiveOffer } from "../offers/offers.service";
import { getServiceCategoryId, getServiceRowById, isServicePurchasableInCity } from "../services/services.service";
import type { CartDto, CartItemDto, CartItemRow, CartRow, MergeSkipped } from "./cart.types";

const CARTS = "carts";
const ITEMS = "cart_items";

/**
 * Server-persisted carts exist only for authenticated customers
 * (`carts.customer_id` is `NOT NULL` — Phase 3 brief: anonymous browsing
 * stays purely client-local). The first cart-touching request for a
 * customer just-in-time creates their row, mirroring the
 * findOrCreate-by-sub pattern used for customers/providers.
 */
async function getOrCreateCartId(customerId: string, trx?: Knex): Promise<string> {
  const db = trx ?? getDb();
  const existing = await db<CartRow>(CARTS).where({ customer_id: customerId }).first();
  if (existing) return existing.id;
  const id = randomUUID();
  await db<CartRow>(CARTS).insert({ id, customer_id: customerId });
  return id;
}

/**
 * BUG FIX ("Duplicate entry for key cart_items_cart_id_service_id_city_id_unique"):
 * both addCartItem and mergeLocalCart used to check "does a row for this
 * (cart_id, service_id, city_id) already exist?" and then separately
 * insert-or-update based on that check -- two round trips with a gap
 * between them. Under any overlap (a double-click, a retried request, two
 * concurrent merge calls for the same cart) both requests could see "not
 * found" before either had written, and both would then try to INSERT the
 * same (cart_id, service_id, city_id) pair, so the second one always hit
 * the unique constraint.
 *
 * This replaces that check-then-act with a single atomic statement --
 * `INSERT ... ON DUPLICATE KEY UPDATE` (knex's cross-dialect
 * onConflict/merge) -- so the database itself resolves the race: whichever
 * request's statement lands second simply updates the row the first one
 * just created, in the same atomic operation, instead of racing a
 * separate SELECT against it. The existing quantity is INCREMENTED by the
 * newly added quantity (never overwritten), matching the documented
 * "matching pairs sum their quantities" behavior -- unchanged semantics,
 * just race-free. The unique constraint itself is untouched; this is what
 * makes the upsert possible at all.
 */
async function upsertCartItem(
  db: Knex,
  cartId: string,
  item: { serviceId: string; cityId: string; quantity: number },
  unitPriceAtAdd: string
): Promise<void> {
  await db<CartItemRow>(ITEMS)
    .insert({
      id: randomUUID(),
      cart_id: cartId,
      service_id: item.serviceId,
      city_id: item.cityId,
      quantity: item.quantity,
      unit_price_at_add: unitPriceAtAdd,
    })
    .onConflict(["cart_id", "service_id", "city_id"])
    .merge({
      quantity: db.raw("?? + ?", ["quantity", item.quantity]),
      updated_at: db.fn.now(),
    });
}

/**
 * PHASE 3 CORRECTION — the cart may now DISPLAY the combined
 * service-discount + effective-offer price (resolved per item's own
 * `cityId`, since a cart can structurally hold items added in different
 * cities — Open Question #16). This is still display-only: order creation
 * (`orders.service.ts`) never reads any of this, it re-resolves everything
 * itself from the database at order time.
 */
async function toItemDto(row: CartItemRow): Promise<CartItemDto> {
  const service = await getServiceRowById(row.service_id);
  const unitPriceAtAdd = Number(row.unit_price_at_add);
  const currentOfferPrice = service ? Number(service.offer_price) : null;
  const isAvailable = service ? await isServicePurchasableInCity(row.service_id, row.city_id) : false;

  let pricing: ReturnType<typeof computeFinalPricing> | null = null;
  let effectiveOffer: Awaited<ReturnType<typeof resolveEffectiveOffer>> = null;
  if (service && isAvailable) {
    const categoryId = await getServiceCategoryId(row.service_id);
    effectiveOffer = await resolveEffectiveOffer(row.city_id, row.service_id, categoryId);
    pricing = computeFinalPricing(Number(service.mrp), Number(service.offer_price), effectiveOffer);
  }

  const finalUnitPrice = pricing ? pricing.finalPrice : unitPriceAtAdd;

  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: service?.name ?? null,
    serviceSlug: service?.slug ?? null,
    cityId: row.city_id,
    quantity: row.quantity,
    unitPriceAtAdd,
    currentOfferPrice,
    priceChanged: currentOfferPrice !== null && currentOfferPrice !== unitPriceAtAdd,
    isAvailable,
    mrp: service ? Number(service.mrp) : null,
    serviceDiscountAmount: pricing?.serviceDiscountAmount ?? 0,
    effectiveOffer,
    offerDiscountAmount: pricing?.offerDiscountAmount ?? 0,
    totalDiscountAmount: pricing?.totalDiscountAmount ?? 0,
    finalUnitPrice,
    lineTotal: Math.round(finalUnitPrice * row.quantity * 100) / 100,
  };
}

export async function getCart(customerId: string): Promise<CartDto> {
  const cartId = await getOrCreateCartId(customerId);
  const rows = await getDb()<CartItemRow>(ITEMS).where({ cart_id: cartId }).orderBy("created_at", "asc");
  const items = await Promise.all(rows.map(toItemDto));
  const subtotal = items.filter((i) => i.isAvailable).reduce((sum, i) => sum + i.lineTotal, 0);
  return {
    id: cartId,
    customerId,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    hasStaleItems: items.some((i) => !i.isAvailable || i.priceChanged),
  };
}

async function assertPurchasable(serviceId: string, cityId: string): Promise<void> {
  const service = await getServiceRowById(serviceId);
  if (!service) throw new NotFoundError("Service not found.");
  const purchasable = await isServicePurchasableInCity(serviceId, cityId);
  if (!purchasable) {
    throw new ConflictError("This service is not currently available in the selected city.");
  }
}

/** Adding an already-in-cart (service, city) pair increases its quantity rather than erroring — the `unique(cart_id, service_id, city_id)` constraint is what makes this an upsert. */
export async function addCartItem(
  customerId: string,
  input: { serviceId: string; cityId: string; quantity: number }
): Promise<CartDto> {
  await assertPurchasable(input.serviceId, input.cityId);
  const service = await getServiceRowById(input.serviceId);
  const cartId = await getOrCreateCartId(customerId);

  await upsertCartItem(getDb(), cartId, input, service!.offer_price);
  return getCart(customerId);
}

async function assertItemOwnedByCustomer(customerId: string, itemId: string): Promise<CartItemRow> {
  const cartId = await getOrCreateCartId(customerId);
  const item = await getDb()<CartItemRow>(ITEMS).where({ id: itemId, cart_id: cartId }).first();
  if (!item) throw new NotFoundError("Cart item not found.");
  return item;
}

export async function setCartItemQuantity(customerId: string, itemId: string, quantity: number): Promise<CartDto> {
  await assertItemOwnedByCustomer(customerId, itemId);
  await getDb()<CartItemRow>(ITEMS).where({ id: itemId }).update({ quantity });
  return getCart(customerId);
}

export async function removeCartItem(customerId: string, itemId: string): Promise<CartDto> {
  await assertItemOwnedByCustomer(customerId, itemId);
  await getDb()<CartItemRow>(ITEMS).where({ id: itemId }).delete();
  return getCart(customerId);
}

/**
 * Login-time merge of the frontend's anonymous, local-only cart into the
 * customer's server cart (Phase 3 brief: "after login, cart must associate
 * with the authenticated Customer with an approved merge/sync behavior").
 * Matching (service, city) pairs sum their quantities; anything no longer
 * purchasable is silently skipped and reported back rather than failing the
 * whole merge — a stale local cart must never block login.
 */
export async function mergeLocalCart(
  customerId: string,
  localItems: { serviceId: string; cityId: string; quantity: number }[]
): Promise<{ cart: CartDto; skipped: MergeSkipped[] }> {
  const skipped: MergeSkipped[] = [];

  // The whole merge is one transaction: finding/creating the cart row and
  // every item's atomic upsert either all commit together or all roll
  // back together, so a mid-merge error (or this process being killed)
  // can never leave some items merged and others not.
  await getDb().transaction(async (trx) => {
    const cartId = await getOrCreateCartId(customerId, trx);

    for (const item of localItems) {
      if (!(item.quantity > 0)) continue;
      const service = await getServiceRowById(item.serviceId);
      if (!service) {
        skipped.push({ serviceId: item.serviceId, cityId: item.cityId, reason: "Service no longer exists." });
        continue;
      }
      const purchasable = await isServicePurchasableInCity(item.serviceId, item.cityId);
      if (!purchasable) {
        skipped.push({
          serviceId: item.serviceId,
          cityId: item.cityId,
          reason: "Service is no longer available in this city.",
        });
        continue;
      }

      await upsertCartItem(trx, cartId, item, service.offer_price);
    }
  });

  return { cart: await getCart(customerId), skipped };
}

/** Used by order creation to empty the cart, inside the same transaction, once its items have been snapshotted into the order. */
export async function clearCart(customerId: string, trx: Knex): Promise<void> {
  const cartId = await getOrCreateCartId(customerId, trx);
  await trx<CartItemRow>(ITEMS).where({ cart_id: cartId }).delete();
}

export { getOrCreateCartId };

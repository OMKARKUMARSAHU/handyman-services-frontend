import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import { getDb } from "../../database/db";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import { roundMoney } from "../../shared/pricing";
import { buildPageMeta, parsePagination, type Meta } from "../../shared/response";
import { logger } from "../../shared/logger";
import { getCustomerById } from "../customers/customers.service";
import { getOwnAddressById } from "../customers/addresses.service";
import { computeDeliveryCharge, getShopSettings } from "./shopSettings.service";
import { computeStockStatus, maxOrderQuantityFor, toNumber } from "./shopProducts.service";
import { effectivePrice, loadCityRules, resolveCity } from "./shopCity.service";
import {
  MAX_QTY_PER_LINE,
  type ShopAdminOrderDto,
  type ShopCartLineDto,
  type ShopCartLineInput,
  type ShopCartPricingDto,
  type ShopOrderDto,
  type ShopOrderItemDto,
  type ShopOrderStatus,
  type ShopPaymentStatus,
} from "./shop.types";

const ORDERS = "shop_orders";
const ITEMS = "shop_order_items";
const PAYMENTS = "shop_payments";

interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  status: ShopOrderStatus;
  payment_status: ShopPaymentStatus;
  subtotal: string | number;
  delivery_charge: string | number;
  total: string | number;
  ship_name: string;
  ship_phone: string | null;
  ship_line1: string;
  ship_line2: string | null;
  ship_city: string;
  ship_state: string;
  ship_pincode: string;
  idempotency_key: string;
  tracking_carrier: string | null;
  tracking_number: string | null;
  shipped_at: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  stock_restored: number | boolean;
  created_at: Date;
  updated_at: Date;
}

interface ItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string;
  product_slug: string | null;
  image_url: string | null;
  unit_price: string | number;
  quantity: number;
  line_total: string | number;
}

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

function toItemDto(r: ItemRow): ShopOrderItemDto {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    productSku: r.product_sku,
    productSlug: r.product_slug,
    imageUrl: r.image_url,
    unitPrice: toNumber(r.unit_price),
    quantity: r.quantity,
    lineTotal: toNumber(r.line_total),
  };
}

function toOrderDto(o: OrderRow, items: ItemRow[]): ShopOrderDto {
  return {
    id: o.id,
    orderNumber: o.order_number,
    customerId: o.customer_id,
    status: o.status,
    paymentStatus: o.payment_status,
    subtotal: toNumber(o.subtotal),
    deliveryCharge: toNumber(o.delivery_charge),
    total: toNumber(o.total),
    shipping: {
      name: o.ship_name,
      phone: o.ship_phone,
      line1: o.ship_line1,
      line2: o.ship_line2,
      city: o.ship_city,
      state: o.ship_state,
      pincode: o.ship_pincode,
    },
    tracking: { carrier: o.tracking_carrier, number: o.tracking_number, shippedAt: iso(o.shipped_at) },
    deliveredAt: iso(o.delivered_at),
    cancelledAt: iso(o.cancelled_at),
    cancelReason: o.cancel_reason,
    items: items.map(toItemDto),
    createdAt: new Date(o.created_at).toISOString(),
    updatedAt: new Date(o.updated_at).toISOString(),
  };
}

function generateShopOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `SHOP-${datePart}-${rand}`;
}

/** Merge duplicate product ids into one line (sum, capped) so a cart can't dodge per-line limits. */
function mergeLines(items: ShopCartLineInput[]): ShopCartLineInput[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.productId, Math.min(MAX_QTY_PER_LINE, (map.get(i.productId) ?? 0) + i.quantity));
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

interface PurchasableRow {
  id: string;
  slug: string;
  sku: string;
  name: string;
  price: string | number;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: number | boolean;
  status: string;
  active: number | boolean;
  category_active: number | boolean | null;
}

async function primaryImageUrls(db: Knex | Knex.Transaction, productIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (productIds.length === 0) return map;
  const rows: Array<{ product_id: string; url: string; is_primary: number | boolean; sort_order: number }> = await db("shop_product_images as i")
    .join("media as m", "m.id", "i.media_id")
    .whereIn("i.product_id", productIds)
    .orderBy([{ column: "i.is_primary", order: "desc" }, { column: "i.sort_order" }])
    .select("i.product_id", "m.url", "i.is_primary", "i.sort_order");
  for (const r of rows) if (!map.has(r.product_id)) map.set(r.product_id, r.url);
  return map;
}

function isPurchasable(r: PurchasableRow): boolean {
  return r.status === "published" && Boolean(r.active) && Boolean(r.category_active);
}

// ---------------------------------------------------------------------------
// Cart pricing — the server is the only source of truth for prices/totals
// ---------------------------------------------------------------------------

export async function priceShopCart(items: ShopCartLineInput[], citySlug?: string): Promise<ShopCartPricingDto> {
  const db = getDb();
  const city = await resolveCity(citySlug, db);
  const lines = mergeLines(items);
  const rows: PurchasableRow[] = await db("shop_products as p")
    .leftJoin("shop_categories as c", "c.id", "p.category_id")
    .whereIn("p.id", lines.map((l) => l.productId))
    .select("p.id", "p.slug", "p.sku", "p.name", "p.price", "p.stock_quantity", "p.low_stock_threshold", "p.track_inventory", "p.status", "p.active", "c.active as category_active");
  const byId = new Map(rows.map((r) => [r.id, r]));
  const images = await primaryImageUrls(db, rows.map((r) => r.id));
  const rules = city ? await loadCityRules(db, rows.map((r) => r.id), city.id) : new Map();

  const out: ShopCartLineDto[] = [];
  for (const line of lines) {
    const r = byId.get(line.productId);
    if (!r || !isPurchasable(r)) {
      out.push({
        productId: line.productId,
        slug: r?.slug ?? null,
        name: r?.name ?? "Unavailable product",
        sku: r?.sku ?? null,
        imageUrl: null,
        unitPrice: 0,
        quantity: line.quantity,
        lineTotal: 0,
        available: false,
        issue: "This product is no longer available.",
        maxOrderQuantity: 0,
      });
      continue;
    }
    const rule = rules.get(r.id);
    const unit = city ? effectivePrice(roundMoney(toNumber(r.price)), rule, city.adjustPercent) : roundMoney(toNumber(r.price));
    const maxQty = maxOrderQuantityFor(r);
    const status = computeStockStatus(r);
    let issue: string | null = null;
    let available = true;
    if (city && rule && !rule.available) {
      available = false;
      issue = `Not available in ${city.name}.`;
    } else if (status === "out_of_stock") {
      available = false;
      issue = "Out of stock.";
    } else if (line.quantity > maxQty) {
      available = false;
      issue = `Only ${maxQty} available.`;
    }
    out.push({
      productId: r.id,
      slug: r.slug,
      name: r.name,
      sku: r.sku,
      imageUrl: images.get(r.id) ?? null,
      unitPrice: unit,
      quantity: line.quantity,
      lineTotal: available ? roundMoney(unit * line.quantity) : 0,
      available,
      issue,
      maxOrderQuantity: maxQty,
    });
  }

  const settings = await getShopSettings();
  const subtotal = roundMoney(out.reduce((s, l) => s + l.lineTotal, 0));
  const deliveryCharge = subtotal > 0 ? computeDeliveryCharge(subtotal, settings) : 0;
  return {
    lines: out,
    subtotal,
    deliveryCharge,
    total: roundMoney(subtotal + deliveryCharge),
    freeDeliveryThreshold: settings.freeDeliveryThreshold,
    canCheckout: Boolean(city) && out.length > 0 && out.every((l) => l.available),
    cityRequired: !city,
    city: city ? { slug: city.slug, name: city.name } : null,
  };
}

// ---------------------------------------------------------------------------
// Inventory helpers
// ---------------------------------------------------------------------------

/**
 * Returns reserved stock to the shelf exactly once per order. The
 * `stock_restored` flag is flipped with a conditional UPDATE, so concurrent or
 * repeated cancellation/expiry/refund paths can never double-restore.
 */
export async function restoreOrderStock(trx: Knex.Transaction, orderId: string): Promise<boolean> {
  const flipped = await trx(ORDERS).where({ id: orderId, stock_restored: false }).update({ stock_restored: true });
  if (!flipped) return false;
  const items: Array<{ product_id: string | null; quantity: number }> = await trx(ITEMS).where({ order_id: orderId }).select("product_id", "quantity");
  for (const it of items) {
    if (!it.product_id) continue;
    await trx("shop_products").where({ id: it.product_id, track_inventory: true }).update({ stock_quantity: trx.raw("stock_quantity + ?", [it.quantity]) });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Order creation (customer)
// ---------------------------------------------------------------------------

export async function loadShopOrder(orderId: string): Promise<{ order: OrderRow; items: ItemRow[] } | null> {
  const db = getDb();
  const order: OrderRow | undefined = await db(ORDERS).where({ id: orderId }).first();
  if (!order) return null;
  const items: ItemRow[] = await db(ITEMS).where({ order_id: orderId }).orderBy("created_at", "asc");
  return { order, items };
}

export async function getShopOrderOwnerCustomerId(orderId: string): Promise<string | null> {
  const row: { customer_id: string } | undefined = await getDb()(ORDERS).where({ id: orderId }).first("customer_id");
  return row?.customer_id ?? null;
}

export async function createShopOrder(
  customerId: string,
  input: { items: ShopCartLineInput[]; addressId: string; idempotencyKey: string; city: string }
): Promise<ShopOrderDto> {
  const db = getDb();

  const existing: OrderRow | undefined = await db(ORDERS).where({ idempotency_key: input.idempotencyKey }).first();
  if (existing) {
    if (existing.customer_id !== customerId) throw new ConflictError("This idempotency key has already been used.");
    return getOwnShopOrder(customerId, existing.id);
  }

  const customer = await getCustomerById(customerId);
  if (!customer) throw new NotFoundError("Customer profile not found.");
  if (customer.accountStatus !== "active") throw new ConflictError("This account is not active.");
  // Throws NotFound if the address isn't this customer's own (ownership enforced here, not trusted from the client).
  const address = await getOwnAddressById(customerId, input.addressId);
  const settings = await getShopSettings();
  const city = await resolveCity(input.city, db);
  if (!city) throw new ValidationError("Please choose your city before placing an order.");
  const lines = mergeLines(input.items);
  const orderId = randomUUID();

  try {
    await db.transaction(async (trx) => {
      // Lock rows in id order: concurrent checkouts touching the same products
      // serialise here, and the fixed order prevents deadlocks.
      const sortedIds = lines.map((l) => l.productId).sort();
      const rows: PurchasableRow[] = await trx("shop_products").whereIn("id", sortedIds).orderBy("id").forUpdate();
      const cats: Array<{ id: string; active: number | boolean }> = await trx("shop_categories").select("id", "active");
      const catActive = new Map(cats.map((c) => [c.id, Boolean(c.active)]));
      const catIdByProduct: Array<{ id: string; category_id: string }> = await trx("shop_products").whereIn("id", sortedIds).select("id", "category_id");
      const productCat = new Map(catIdByProduct.map((r) => [r.id, r.category_id]));
      const byId = new Map(rows.map((r) => [r.id, { ...r, category_active: catActive.get(productCat.get(r.id) ?? "") ?? false }]));
      const images = await primaryImageUrls(trx, sortedIds);
      const rules = await loadCityRules(trx, sortedIds, city.id);

      let subtotal = 0;
      const itemRows: Array<Record<string, unknown>> = [];
      for (const line of lines) {
        const r = byId.get(line.productId);
        if (!r || !isPurchasable(r)) {
          throw new ConflictError(`${r?.name ?? "A product in your cart"} is no longer available. Please review your cart.`);
        }
        const rule = rules.get(r.id);
        if (rule && !rule.available) throw new ConflictError(`${r.name} is not available in ${city.name}. Please review your cart.`);
        const track = Boolean(r.track_inventory);
        if (track) {
          if (r.stock_quantity < line.quantity) {
            throw new ConflictError(r.stock_quantity <= 0 ? `${r.name} is out of stock.` : `Only ${r.stock_quantity} of ${r.name} left in stock.`);
          }
          // Guarded decrement: the WHERE clause is the oversell barrier, even
          // if something bypassed the row lock above.
          const changed = await trx("shop_products")
            .where({ id: r.id })
            .andWhere("stock_quantity", ">=", line.quantity)
            .update({ stock_quantity: trx.raw("stock_quantity - ?", [line.quantity]) });
          if (!changed) throw new ConflictError(`${r.name} just sold out. Please review your cart.`);
        }
        const unit = effectivePrice(roundMoney(toNumber(r.price)), rule, city.adjustPercent);
        const lineTotal = roundMoney(unit * line.quantity);
        subtotal = roundMoney(subtotal + lineTotal);
        itemRows.push({
          id: randomUUID(),
          order_id: orderId,
          product_id: r.id,
          product_name: r.name,
          product_sku: r.sku,
          product_slug: r.slug,
          image_url: images.get(r.id) ?? null,
          unit_price: unit,
          quantity: line.quantity,
          line_total: lineTotal,
        });
      }

      const deliveryCharge = computeDeliveryCharge(subtotal, settings);
      await trx(ORDERS).insert({
        id: orderId,
        order_number: generateShopOrderNumber(),
        customer_id: customerId,
        status: "pending_payment",
        payment_status: "unpaid",
        subtotal,
        delivery_charge: deliveryCharge,
        total: roundMoney(subtotal + deliveryCharge),
        ship_name: customer.name,
        ship_phone: customer.phone,
        ship_line1: address.line1,
        ship_line2: address.line2,
        ship_city: address.city,
        ship_state: address.state,
        ship_pincode: address.pincode,
        idempotency_key: input.idempotencyKey,
        city_id: city.id,
      });
      await trx(ITEMS).insert(itemRows);
    });
  } catch (err) {
    // Two simultaneous submits with the same key: the loser's transaction
    // (including its stock decrement) is rolled back; return the winner's order.
    if (err && typeof err === "object" && (err as { code?: string }).code === "ER_DUP_ENTRY") {
      const winner: OrderRow | undefined = await db(ORDERS).where({ idempotency_key: input.idempotencyKey, customer_id: customerId }).first();
      if (winner) return getOwnShopOrder(customerId, winner.id);
    }
    throw err;
  }
  return getOwnShopOrder(customerId, orderId);
}

export async function getOwnShopOrder(customerId: string, orderId: string): Promise<ShopOrderDto> {
  const loaded = await loadShopOrder(orderId);
  if (!loaded || loaded.order.customer_id !== customerId) throw new NotFoundError("Order not found.");
  return toOrderDto(loaded.order, loaded.items);
}

export async function listOwnShopOrders(customerId: string, params: { page?: number; pageSize?: number }): Promise<{ items: ShopOrderDto[]; meta: Meta }> {
  const db = getDb();
  const pagination = parsePagination(params);
  const totalRow = (await db(ORDERS).where({ customer_id: customerId }).count({ n: "id" }).first()) as unknown as { n: number | string };
  const orders: OrderRow[] = await db(ORDERS)
    .where({ customer_id: customerId })
    .orderBy("created_at", "desc")
    .limit(pagination.pageSize)
    .offset((pagination.page - 1) * pagination.pageSize);
  const items: ItemRow[] = orders.length ? await db(ITEMS).whereIn("order_id", orders.map((o) => o.id)).orderBy("created_at", "asc") : [];
  return {
    items: orders.map((o) => toOrderDto(o, items.filter((i) => i.order_id === o.id))),
    meta: buildPageMeta(pagination, Number(totalRow?.n ?? 0)),
  };
}

/** Customer cancel: only while still unpaid (a paid order is cancelled by an admin so a refund isn't skipped). */
export async function cancelOwnShopOrder(customerId: string, orderId: string): Promise<ShopOrderDto> {
  const db = getDb();
  await db.transaction(async (trx) => {
    const order: OrderRow | undefined = await trx(ORDERS).where({ id: orderId, customer_id: customerId }).forUpdate().first();
    if (!order) throw new NotFoundError("Order not found.");
    if (order.status !== "pending_payment" || order.payment_status === "paid") {
      throw new ConflictError("Only an unpaid order can be cancelled here. Please contact support for paid orders.");
    }
    await trx(ORDERS).where({ id: orderId }).update({ status: "cancelled", cancelled_at: trx.fn.now(), cancel_reason: "Cancelled by customer before payment" });
    await restoreOrderStock(trx, orderId);
  });
  return getOwnShopOrder(customerId, orderId);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Valid fulfilment transitions. `pending_payment → paid` is deliberately absent: only verified payment can do that. */
export const SHOP_ORDER_TRANSITIONS: Record<ShopOrderStatus, ShopOrderStatus[]> = {
  pending_payment: ["cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

export async function listAdminShopOrders(params: {
  search?: string;
  status?: ShopOrderStatus;
  paymentStatus?: ShopPaymentStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ShopAdminOrderDto[]; meta: Meta }> {
  const db = getDb();
  const pagination = parsePagination(params);
  const q = db(`${ORDERS} as o`).join("customers as c", "c.id", "o.customer_id");
  if (params.status) q.where("o.status", params.status);
  if (params.paymentStatus) q.where("o.payment_status", params.paymentStatus);
  if (params.search?.trim()) {
    const like = `%${params.search.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    q.where((b) => b.where("o.order_number", "like", like).orWhere("c.name", "like", like).orWhere("c.email", "like", like).orWhere("c.phone", "like", like));
  }
  const totalRow = (await q.clone().count({ n: "o.id" }).first()) as unknown as { n: number | string };
  const orders: OrderRow[] = await q
    .clone()
    .select("o.*")
    .orderBy("o.created_at", "desc")
    .limit(pagination.pageSize)
    .offset((pagination.page - 1) * pagination.pageSize);
  return { items: await hydrateAdminOrders(orders), meta: buildPageMeta(pagination, Number(totalRow?.n ?? 0)) };
}

async function hydrateAdminOrders(orders: OrderRow[]): Promise<ShopAdminOrderDto[]> {
  if (orders.length === 0) return [];
  const db = getDb();
  const ids = orders.map((o) => o.id);
  const [items, customers, payments] = await Promise.all([
    db(ITEMS).whereIn("order_id", ids).orderBy("created_at", "asc") as unknown as Promise<ItemRow[]>,
    db("customers").whereIn("id", orders.map((o) => o.customer_id)).select("id", "name", "email", "phone") as unknown as Promise<
      Array<{ id: string; name: string; email: string | null; phone: string | null }>
    >,
    db(PAYMENTS).whereIn("order_id", ids).orderBy("created_at", "desc") as unknown as Promise<
      Array<{ order_id: string; provider: string; provider_order_id: string; provider_payment_id: string | null; status: string; signature_verified: number | boolean; failure_reason: string | null }>
    >,
  ]);
  const custById = new Map(customers.map((c) => [c.id, c]));
  return orders.map((o) => {
    const c = custById.get(o.customer_id);
    const p = payments.find((x) => x.order_id === o.id);
    return {
      ...toOrderDto(o, items.filter((i) => i.order_id === o.id)),
      customer: { id: o.customer_id, name: c?.name ?? "Unknown", email: c?.email ?? null, phone: c?.phone ?? null },
      payment: p
        ? {
            provider: p.provider,
            providerOrderId: p.provider_order_id,
            providerPaymentId: p.provider_payment_id,
            status: p.status,
            signatureVerified: Boolean(p.signature_verified),
            failureReason: p.failure_reason,
          }
        : null,
    };
  });
}

export async function getAdminShopOrder(orderId: string): Promise<ShopAdminOrderDto> {
  const order: OrderRow | undefined = await getDb()(ORDERS).where({ id: orderId }).first();
  if (!order) throw new NotFoundError("Order not found.");
  return (await hydrateAdminOrders([order]))[0]!;
}

export async function updateShopOrderStatus(
  orderId: string,
  input: { status: ShopOrderStatus; trackingCarrier?: string | null; trackingNumber?: string | null; reason?: string | null }
): Promise<ShopAdminOrderDto> {
  const db = getDb();
  await db.transaction(async (trx) => {
    const order: OrderRow | undefined = await trx(ORDERS).where({ id: orderId }).forUpdate().first();
    if (!order) throw new NotFoundError("Order not found.");
    const allowed = SHOP_ORDER_TRANSITIONS[order.status];
    if (!allowed.includes(input.status)) {
      throw new ConflictError(`An order that is "${order.status}" cannot be moved to "${input.status}".`, { allowed });
    }
    const patch: Record<string, unknown> = { status: input.status };

    if (input.status === "refunded") {
      // A refund can only be recorded against a payment that was really captured.
      if (order.payment_status !== "paid") throw new ConflictError("Only an order with a verified payment can be marked refunded.");
      // Records that a refund was issued (manually, outside this system) — it does NOT call the gateway.
      patch.payment_status = "refunded";
    }
    if (input.status === "shipped") {
      patch.shipped_at = trx.fn.now();
      if (input.trackingCarrier !== undefined) patch.tracking_carrier = input.trackingCarrier;
      if (input.trackingNumber !== undefined) patch.tracking_number = input.trackingNumber;
    }
    if (input.status === "delivered") patch.delivered_at = trx.fn.now();
    if (input.status === "cancelled") {
      patch.cancelled_at = trx.fn.now();
      patch.cancel_reason = input.reason ?? "Cancelled by admin";
    }
    await trx(ORDERS).where({ id: orderId }).update(patch);

    // Goods that never left the warehouse go back on the shelf (idempotent).
    if (input.status === "cancelled" || (input.status === "refunded" && ["paid", "processing", "cancelled"].includes(order.status))) {
      await restoreOrderStock(trx, orderId);
    }
  });
  return getAdminShopOrder(orderId);
}

/** Admin: update tracking details without changing status. */
export async function updateShopOrderTracking(orderId: string, input: { trackingCarrier?: string | null; trackingNumber?: string | null }): Promise<ShopAdminOrderDto> {
  const patch: Record<string, unknown> = {};
  if (input.trackingCarrier !== undefined) patch.tracking_carrier = input.trackingCarrier;
  if (input.trackingNumber !== undefined) patch.tracking_number = input.trackingNumber;
  if (Object.keys(patch).length === 0) throw new ValidationError("Provide tracking details to update.");
  const n = await getDb()(ORDERS).where({ id: orderId }).update(patch);
  if (!n && !(await getDb()(ORDERS).where({ id: orderId }).first("id"))) throw new NotFoundError("Order not found.");
  return getAdminShopOrder(orderId);
}

/**
 * Cancels unpaid orders whose payment window has passed and returns their
 * reserved stock. Idempotent: a conditional UPDATE only matches orders that are
 * still `pending_payment`, so overlapping runs never double-restore.
 */
export async function expireStalePendingShopOrders(maxAgeMinutes: number): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
  const stale: Array<{ id: string }> = await db(ORDERS).where({ status: "pending_payment" }).andWhere("created_at", "<", cutoff).select("id").limit(200);
  let expired = 0;
  for (const { id } of stale) {
    try {
      await db.transaction(async (trx) => {
        const changed = await trx(ORDERS)
          .where({ id, status: "pending_payment" })
          .update({ status: "cancelled", cancelled_at: trx.fn.now(), cancel_reason: "Payment not completed in time" });
        if (changed) {
          await restoreOrderStock(trx, id);
          expired++;
        }
      });
    } catch (err) {
      logger.error({ err, orderId: id }, "shop_order_expiry_failed");
    }
  }
  return expired;
}

import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { computeFinalPricing } from "../../shared/pricing";
import type { PaginationParams } from "../../shared/response";
import { getOwnAddressById } from "../customers/addresses.service";
import { resolveEffectiveOffer } from "../offers/offers.service";
import type { OfferDto } from "../offers/offers.types";
import { getServiceCategoryId, getServiceRowById, isServicePurchasableInCity } from "../services/services.service";
import { clearCart } from "../cart/cart.service";
import type { CartItemRow, CartRow } from "../cart/cart.types";
import { toOrderDto, type OrderDto, type OrderItemRow, type OrderRow, type OrderStatus } from "./orders.types";

const ORDERS = "orders";
const ORDER_ITEMS = "order_items";
const CART_ITEMS = "cart_items";
const CARTS = "carts";

function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = (randomUUID().split("-")[0] ?? randomUUID().replace(/-/g, "").slice(0, 8)).toUpperCase();
  return `ORD-${datePart}-${randomPart}`;
}

async function loadOrder(id: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null> {
  const order = await getDb()<OrderRow>(ORDERS).where({ id }).first();
  if (!order) return null;
  const items = await getDb()<OrderItemRow>(ORDER_ITEMS).where({ order_id: id }).orderBy("created_at", "asc");
  return { order, items };
}

/** Used by `requireOwnership()` on `/customer/orders/:id` — resolves the Cognito sub of the order's customer, or null if the order doesn't exist. */
export async function getOrderOwnerSub(orderId: string): Promise<string | null> {
  const row = await getDb()(ORDERS)
    .join("customers", "customers.id", `${ORDERS}.customer_id`)
    .where(`${ORDERS}.id`, orderId)
    .first<{ cognito_sub: string } | undefined>("customers.cognito_sub as cognito_sub");
  return row ? row.cognito_sub : null;
}

export interface CreateOrderInput {
  addressId: string;
  scheduledDate: string;
  scheduledSlot?: string | null;
  idempotencyKey: string;
}

/**
 * The most security-critical write in the backend (PHASE_3 brief, "ORDER
 * CREATION"): authenticate → validate cart → re-fetch authoritative DB
 * prices → validate availability → compute totals server-side → snapshot
 * item pricing and address → create transactionally. The request body
 * carries NO price, total, or discount field at all — there is nothing for
 * the client to submit that this function would need to distrust, because
 * every money figure here is re-derived from `services` inside this call.
 */
export async function createOrder(customerId: string, input: CreateOrderInput): Promise<OrderDto> {
  // Idempotency: a retried submission with the same key returns the order
  // already created for it rather than creating a duplicate.
  const existingByKey = await getDb()<OrderRow>(ORDERS).where({ idempotency_key: input.idempotencyKey }).first();
  if (existingByKey) {
    if (existingByKey.customer_id !== customerId) {
      throw new ConflictError("This idempotency key has already been used for a different order.");
    }
    const loaded = await loadOrder(existingByKey.id);
    return toOrderDto(loaded!.order, loaded!.items);
  }

  // Address must belong to the authenticated customer — throws NotFoundError otherwise.
  const address = await getOwnAddressById(customerId, input.addressId);

  const cart = await getDb()<CartRow>(CARTS).where({ customer_id: customerId }).first();
  const cartItems = cart ? await getDb()<CartItemRow>(CART_ITEMS).where({ cart_id: cart.id }) : [];
  if (cartItems.length === 0) {
    throw new ConflictError("Your cart is empty — add at least one service before checking out.");
  }

  // Re-fetch authoritative prices and re-validate availability for every
  // item — never trust anything already sitting in the cart row, since it
  // may have gone stale since it was added. PHASE 3 CORRECTION: for each
  // line, also re-resolve the ONE effective Offer (CITY beats ALL_INDIA,
  // never both — see offers.service.ts) for that item's own city, and
  // combine it with the service's own discount via computeFinalPricing —
  // the single, shared pricing function, so order-time math can never
  // drift from what the catalog/cart display showed.
  const lineInputs: {
    serviceId: string;
    name: string;
    quantity: number;
    mrp: number;
    offerPrice: number;
    serviceDiscountAmount: number;
    effectiveOffer: OfferDto | null;
    offerDiscountAmount: number;
    totalDiscountAmount: number;
    finalUnitPrice: number;
  }[] = [];
  for (const item of cartItems) {
    const service = await getServiceRowById(item.service_id);
    if (!service) {
      throw new ConflictError(`A service in your cart no longer exists (id: ${item.service_id}). Please update your cart.`);
    }
    const purchasable = await isServicePurchasableInCity(item.service_id, item.city_id);
    if (!purchasable) {
      throw new ConflictError(`"${service.name}" is no longer available in the selected city. Please update your cart.`);
    }

    const mrp = Number(service.mrp);
    const offerPrice = Number(service.offer_price);
    const categoryId = await getServiceCategoryId(item.service_id);
    const effectiveOffer = await resolveEffectiveOffer(item.city_id, item.service_id, categoryId);
    const pricing = computeFinalPricing(mrp, offerPrice, effectiveOffer);

    lineInputs.push({
      serviceId: item.service_id,
      name: service.name,
      quantity: item.quantity,
      mrp,
      offerPrice,
      serviceDiscountAmount: pricing.serviceDiscountAmount,
      effectiveOffer,
      offerDiscountAmount: pricing.offerDiscountAmount,
      totalDiscountAmount: pricing.totalDiscountAmount,
      finalUnitPrice: pricing.finalPrice,
    });
  }

  const subtotal = round(lineInputs.reduce((sum, l) => sum + l.mrp * l.quantity, 0));
  const total = round(lineInputs.reduce((sum, l) => sum + l.finalUnitPrice * l.quantity, 0));
  const discountTotal = round(subtotal - total);

  const orderId = randomUUID();
  const orderNumber = generateOrderNumber();

  await getDb().transaction(async (trx) => {
    await trx<OrderRow>(ORDERS).insert({
      id: orderId,
      order_number: orderNumber,
      customer_id: customerId,
      address_label: address.label,
      address_line1: address.line1,
      address_line2: address.line2,
      address_city: address.city,
      address_state: address.state,
      address_pincode: address.pincode,
      scheduled_date: input.scheduledDate,
      scheduled_slot: input.scheduledSlot ?? null,
      subtotal,
      discount_total: discountTotal,
      total,
      status: "pending",
      provider_id: null,
      payment_status: "not_applicable",
      idempotency_key: input.idempotencyKey,
    } as unknown as OrderRow);

    for (const line of lineInputs) {
      await trx<OrderItemRow>(ORDER_ITEMS).insert({
        id: randomUUID(),
        order_id: orderId,
        service_id: line.serviceId,
        service_name_snapshot: line.name,
        quantity: line.quantity,
        mrp_snapshot: line.mrp,
        service_offer_price_snapshot: line.offerPrice,
        service_discount_amount: line.serviceDiscountAmount,
        effective_offer_id: line.effectiveOffer?.id ?? null,
        effective_offer_name_snapshot: line.effectiveOffer?.title ?? null,
        effective_offer_applicability_type_snapshot: line.effectiveOffer?.applicabilityType ?? null,
        offer_discount_amount: line.offerDiscountAmount,
        total_discount_amount: line.totalDiscountAmount,
        unit_price: line.finalUnitPrice,
        line_total: round(line.finalUnitPrice * line.quantity),
      } as unknown as OrderItemRow);
    }

    await clearCart(customerId, trx);
  });

  const loaded = await loadOrder(orderId);
  if (!loaded) throw new Error("Failed to read back created order.");
  return toOrderDto(loaded.order, loaded.items);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getOwnOrderById(customerId: string, orderId: string): Promise<OrderDto> {
  const loaded = await loadOrder(orderId);
  if (!loaded || loaded.order.customer_id !== customerId) throw new NotFoundError("Order not found.");
  return toOrderDto(loaded.order, loaded.items);
}

export async function listOwnOrders(
  customerId: string,
  pagination: PaginationParams
): Promise<{ items: OrderDto[]; total: number }> {
  const query = getDb()<OrderRow>(ORDERS).where({ customer_id: customerId });
  const countRow = await query.clone().count<{ count: string }[]>("id as count").first();
  const total = Number(countRow?.count ?? 0);
  const rows = await query
    .clone()
    .orderBy("created_at", "desc")
    .offset((pagination.page - 1) * pagination.pageSize)
    .limit(pagination.pageSize);
  const items = await Promise.all(
    rows.map(async (row) => {
      const orderItems = await getDb()<OrderItemRow>(ORDER_ITEMS).where({ order_id: row.id });
      return toOrderDto(row, orderItems);
    })
  );
  return { items, total };
}

/** Admin-only operational view across all customers' orders — read-only listing plus a status transition, mirroring the admin management pattern used for customers/providers. */
/**
 * Admin Overview stat cards (MASTER TASK follow-up — "Revenue/other
 * meaningful metrics where the backend supports them. No hardcoded
 * numbers."). A real aggregate over the whole `orders` table, not a
 * client-side sum over one paginated page — so the dashboard's revenue
 * figure is honest even once there are more orders than one page shows.
 */
export async function getOrderStats(): Promise<{
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
}> {
  const db = getDb();
  const [totalRow, pendingRow, completedRow, revenueRow] = await Promise.all([
    db<OrderRow>(ORDERS).count<{ count: string }[]>("id as count").first(),
    db<OrderRow>(ORDERS).where({ status: "pending" }).count<{ count: string }[]>("id as count").first(),
    db<OrderRow>(ORDERS).where({ status: "completed" }).count<{ count: string }[]>("id as count").first(),
    db<OrderRow>(ORDERS).where({ status: "completed" }).sum<{ sum: string | null }[]>("total as sum").first(),
  ]);
  return {
    totalOrders: Number(totalRow?.count ?? 0),
    pendingOrders: Number(pendingRow?.count ?? 0),
    completedOrders: Number(completedRow?.count ?? 0),
    totalRevenue: Number(revenueRow?.sum ?? 0),
  };
}

export async function listAllOrders(
  filters: { status?: OrderStatus },
  pagination: PaginationParams
): Promise<{ items: OrderDto[]; total: number }> {
  let query = getDb()<OrderRow>(ORDERS);
  if (filters.status) query = query.andWhere({ status: filters.status });
  const countRow = await query.clone().count<{ count: string }[]>("id as count").first();
  const total = Number(countRow?.count ?? 0);
  const rows = await query
    .clone()
    .orderBy("created_at", "desc")
    .offset((pagination.page - 1) * pagination.pageSize)
    .limit(pagination.pageSize);
  const items = await Promise.all(
    rows.map(async (row) => {
      const orderItems = await getDb()<OrderItemRow>(ORDER_ITEMS).where({ order_id: row.id });
      return toOrderDto(row, orderItems);
    })
  );
  return { items, total };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, providerId?: string | null): Promise<OrderDto> {
  const existing = await getDb()<OrderRow>(ORDERS).where({ id: orderId }).first();
  if (!existing) throw new NotFoundError("Order not found.");
  const patch: Partial<OrderRow> = { status };
  if (providerId !== undefined) patch.provider_id = providerId;
  await getDb()<OrderRow>(ORDERS).where({ id: orderId }).update(patch);
  const loaded = await loadOrder(orderId);
  return toOrderDto(loaded!.order, loaded!.items);
}

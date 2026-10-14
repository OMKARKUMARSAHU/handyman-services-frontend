import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Knex } from "knex";
import { env } from "../../config/env";
import { getDb } from "../../database/db";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import { logger } from "../../shared/logger";
import { getRazorpayClient } from "../payments/payments.service";
import { loadShopOrder } from "./shopOrders.service";

/**
 * Shop payments (Razorpay TEST mode). Core guarantees:
 *  - An order is marked paid ONLY after an HMAC signature is verified
 *    server-side — either the browser-callback signature (order_id|payment_id,
 *    keyed with the API secret) or the webhook signature (raw body, keyed with
 *    the webhook secret). The browser's "success" callback alone never counts.
 *  - Processing is idempotent: a payment row can succeed once; webhook events
 *    are de-duplicated on Razorpay's event id (UNIQUE) inside the same
 *    transaction that applies them, so a crash leaves nothing half-done and a
 *    replay is safe.
 *  - The amount reported by the gateway must equal the amount we asked for.
 *  - No card data ever touches this backend; secrets are read from env only.
 */

const ORDERS = "shop_orders";
const PAYMENTS = "shop_payments";
const EVENTS = "shop_payment_events";

interface PaymentRow {
  id: string;
  order_id: string;
  provider_order_id: string;
  provider_payment_id: string | null;
  amount: string | number;
  status: "initiated" | "succeeded" | "failed";
}

export interface ShopRazorpayOrderResponse {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: "INR";
  orderId: string;
  orderNumber: string;
}

function safeEqualHex(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function computeCheckoutSignature(razorpayOrderId: string, razorpayPaymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
}

export function computeWebhookSignature(rawBody: Buffer | string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

const toPaise = (amount: string | number): number => Math.round(Number(amount) * 100);

export async function createShopRazorpayOrder(customerId: string, orderId: string): Promise<ShopRazorpayOrderResponse> {
  const loaded = await loadShopOrder(orderId);
  if (!loaded || loaded.order.customer_id !== customerId) throw new NotFoundError("Order not found.");
  const order = loaded.order;
  if (order.payment_status === "paid") throw new ConflictError("This order has already been paid for.");
  if (order.status !== "pending_payment") throw new ConflictError(`An order that is "${order.status}" can no longer be paid.`);

  const amountPaise = toPaise(order.total);
  const razorpay = getRazorpayClient();
  let rzOrder: { id: string };
  try {
    rzOrder = await razorpay.orders.create({ amount: amountPaise, currency: "INR", receipt: order.order_number, notes: { shopOrderId: order.id } });
  } catch (err) {
    const gatewayError = err as { statusCode?: number; error?: { code?: string; description?: string } };
    logger.error({ orderId: order.id, statusCode: gatewayError?.statusCode, razorpayError: gatewayError?.error }, "shop_razorpay_order_create_failed");
    throw new AppError(502, "INTERNAL_ERROR", "The payment gateway rejected the request. Please try again shortly.");
  }

  await getDb().transaction(async (trx) => {
    await trx(PAYMENTS).insert({
      id: randomUUID(),
      order_id: order.id,
      provider: "razorpay",
      provider_order_id: rzOrder.id,
      amount: order.total,
      status: "initiated",
      signature_verified: false,
    });
    await trx(ORDERS).where({ id: order.id, status: "pending_payment" }).whereNot({ payment_status: "paid" }).update({ payment_status: "pending" });
  });

  return { keyId: env.RAZORPAY_KEY_ID!, razorpayOrderId: rzOrder.id, amount: amountPaise, currency: "INR", orderId: order.id, orderNumber: order.order_number };
}

type CaptureOutcome = "paid" | "already_paid" | "paid_after_cancel" | "amount_mismatch";

/**
 * The ONE place an order becomes paid. Runs inside the caller's transaction.
 * Safe to call repeatedly for the same payment (idempotent).
 */
async function applyVerifiedCapture(
  trx: Knex.Transaction,
  payment: PaymentRow,
  razorpayPaymentId: string,
  gatewayAmountPaise: number | null
): Promise<CaptureOutcome> {
  const locked: PaymentRow | undefined = await trx(PAYMENTS).where({ id: payment.id }).forUpdate().first();
  if (!locked) throw new NotFoundError("Payment not found.");
  if (locked.status === "succeeded") return "already_paid";

  if (gatewayAmountPaise != null && gatewayAmountPaise !== toPaise(locked.amount)) {
    await trx(PAYMENTS).where({ id: locked.id }).update({ status: "failed", failure_reason: "Gateway amount did not match the order total." });
    logger.error({ paymentId: locked.id, orderId: locked.order_id }, "shop_payment_amount_mismatch");
    return "amount_mismatch";
  }

  await trx(PAYMENTS).where({ id: locked.id }).update({ status: "succeeded", provider_payment_id: razorpayPaymentId, signature_verified: true, failure_reason: null });

  const advanced = await trx(ORDERS).where({ id: locked.order_id, status: "pending_payment" }).update({ status: "paid", payment_status: "paid" });
  if (advanced) return "paid";

  // The order left pending_payment before the (genuine) payment landed — e.g. it
  // expired or was cancelled. Money was really captured, so record that fact;
  // the status stays as-is and the admin sees paid+cancelled to action a refund.
  await trx(ORDERS).where({ id: locked.order_id }).whereNot({ payment_status: "refunded" }).update({ payment_status: "paid" });
  logger.warn({ orderId: locked.order_id, paymentId: locked.id }, "shop_payment_after_order_closed");
  return "paid_after_cancel";
}

export async function verifyShopRazorpayPayment(
  customerId: string,
  orderId: string,
  input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<{ paymentStatus: "paid"; orderId: string; outcome: CaptureOutcome }> {
  const loaded = await loadShopOrder(orderId);
  if (!loaded || loaded.order.customer_id !== customerId) throw new NotFoundError("Order not found.");
  if (!env.RAZORPAY_KEY_SECRET) throw new AppError(503, "INTERNAL_ERROR", "The payment gateway is not configured.");

  const payment: PaymentRow | undefined = await getDb()(PAYMENTS).where({ order_id: orderId, provider_order_id: input.razorpay_order_id }).first();
  if (!payment) throw new ConflictError("No matching payment attempt was found for this order.");

  const expected = computeCheckoutSignature(input.razorpay_order_id, input.razorpay_payment_id, env.RAZORPAY_KEY_SECRET);
  if (!safeEqualHex(expected, input.razorpay_signature)) {
    // Deliberately does NOT mark the attempt failed: anyone can send a bad
    // signature, and that must not be able to cancel a genuine payment.
    logger.warn({ orderId, paymentId: payment.id }, "shop_razorpay_signature_verification_failed");
    throw new ValidationError("Payment verification failed — the payment signature did not match.");
  }

  const outcome = await getDb().transaction((trx) => applyVerifiedCapture(trx, payment, input.razorpay_payment_id, null));
  if (outcome === "amount_mismatch") throw new ConflictError("Payment verification failed.");
  return { paymentStatus: "paid", orderId, outcome };
}

/** Client-observed failure/dismissal. Can only move an `initiated` attempt to `failed`; can never mark anything paid. */
export async function markShopPaymentFailed(customerId: string, orderId: string, razorpayOrderId: string): Promise<void> {
  const loaded = await loadShopOrder(orderId);
  if (!loaded || loaded.order.customer_id !== customerId) throw new NotFoundError("Order not found.");
  await getDb().transaction(async (trx) => {
    const n = await trx(PAYMENTS).where({ order_id: orderId, provider_order_id: razorpayOrderId, status: "initiated" }).update({ status: "failed", failure_reason: "Payment was not completed." });
    if (n) await trx(ORDERS).where({ id: orderId, status: "pending_payment", payment_status: "pending" }).update({ payment_status: "failed" });
  });
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string; error_description?: string } };
    order?: { entity?: { id?: string; amount_paid?: number } };
  };
}

export interface WebhookResult {
  status: "processed" | "duplicate" | "ignored";
  result?: string;
}

export async function handleShopRazorpayWebhook(rawBody: Buffer | undefined, signature: string | undefined, eventIdHeader: string | undefined): Promise<WebhookResult> {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new AppError(503, "INTERNAL_ERROR", "The payment webhook is not configured.");
  if (!rawBody || !signature) throw new ValidationError("Missing webhook body or signature.");
  const expected = computeWebhookSignature(rawBody, env.RAZORPAY_WEBHOOK_SECRET);
  if (!safeEqualHex(expected, signature)) {
    logger.warn({}, "shop_webhook_signature_invalid");
    throw new ValidationError("Invalid webhook signature.");
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody.toString("utf8")) as RazorpayWebhookBody;
  } catch {
    throw new ValidationError("Malformed webhook body.");
  }
  const eventType = body.event ?? "unknown";
  const payEntity = body.payload?.payment?.entity;
  // Razorpay's event id header is unique per event and stable across retries; the
  // body hash is the fallback if a proxy strips the header.
  const eventId = (eventIdHeader && eventIdHeader.slice(0, 120)) || `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;

  return getDb().transaction(async (trx): Promise<WebhookResult> => {
    try {
      await trx(EVENTS).insert({
        id: randomUUID(),
        provider_event_id: eventId,
        event_type: eventType.slice(0, 80),
        // Reduced payload — no customer contact details are persisted.
        payload: JSON.stringify({ event: eventType, paymentId: payEntity?.id ?? null, orderId: payEntity?.order_id ?? null, amount: payEntity?.amount ?? null, status: payEntity?.status ?? null }),
      });
    } catch (err) {
      if (err && typeof err === "object" && (err as { code?: string }).code === "ER_DUP_ENTRY") return { status: "duplicate" };
      throw err;
    }

    let result = "ignored";
    let status: WebhookResult["status"] = "ignored";

    if ((eventType === "payment.captured" || eventType === "order.paid") && payEntity?.id && payEntity.order_id) {
      const payment: PaymentRow | undefined = await trx(PAYMENTS).where({ provider_order_id: payEntity.order_id }).first();
      if (!payment) {
        result = "unknown_order";
      } else {
        result = await applyVerifiedCapture(trx, payment, payEntity.id, typeof payEntity.amount === "number" ? payEntity.amount : null);
        status = "processed";
      }
    } else if (eventType === "payment.failed" && payEntity?.order_id) {
      const n = await trx(PAYMENTS)
        .where({ provider_order_id: payEntity.order_id, status: "initiated" })
        .update({ status: "failed", failure_reason: (payEntity.error_description ?? "Payment failed.").slice(0, 500) });
      if (n) {
        const p: PaymentRow | undefined = await trx(PAYMENTS).where({ provider_order_id: payEntity.order_id }).first();
        if (p) await trx(ORDERS).where({ id: p.order_id, status: "pending_payment", payment_status: "pending" }).update({ payment_status: "failed" });
      }
      result = n ? "payment_failed_recorded" : "no_open_attempt";
      status = "processed";
    }

    await trx(EVENTS).where({ provider_event_id: eventId }).update({ processed_at: trx.fn.now(), result: result.slice(0, 120) });
    return { status, result };
  });
}

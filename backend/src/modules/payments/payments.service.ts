import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { getDb } from "../../database/db";
import { env } from "../../config/env";
import { logger } from "../../shared/logger";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import type { OrderRow } from "../orders/orders.types";
import type {
  PaymentRow,
  PaymentVerifyResultDto,
  RazorpayOrderResponseDto,
  RazorpayVerifyInput,
} from "./payments.types";

const ORDERS = "orders";
const PAYMENTS = "payments";

/**
 * Lazy singleton, mirroring the existing getS3Client() pattern
 * (media.service.ts) — never constructed at module-import time, so the
 * backend still boots cleanly with no gateway configured (local dev before
 * the user has set their test keys). Only the one request that actually
 * needs it fails, with a clear message, instead of the whole process.
 */
let client: Razorpay | null = null;
function getRazorpayClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError(
      503,
      "INTERNAL_ERROR",
      "The payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test mode) in the backend's .env."
    );
  }
  // Defensive format check, never logs or echoes either value: every real
  // Razorpay key id (test or live) starts with "rzp_test_"/"rzp_live_".
  // Catches the easy-to-make mistake of pasting a DIFFERENT provider's
  // credentials (e.g. an AWS Access Key ID, which looks like "AKIA...")
  // into these two env vars -- that mistake would otherwise only surface
  // as an opaque Razorpay 401 deep inside orders.create(), logged as a
  // generic "unhandled_error" with no hint at the actual cause.
  if (!/^rzp_(test|live)_/.test(env.RAZORPAY_KEY_ID)) {
    throw new AppError(
      503,
      "INTERNAL_ERROR",
      "RAZORPAY_KEY_ID in backend/.env does not look like a Razorpay key (it should start with \"rzp_test_\" for test mode). " +
        "Generate a Test Mode key pair from the Razorpay Dashboard (Settings -> API Keys) and put ONLY those two values in RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET -- " +
        "do not reuse credentials from another provider (e.g. AWS)."
    );
  }
  if (!client) {
    client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return client;
}

async function loadOwnOrder(customerId: string, orderId: string): Promise<OrderRow> {
  const order = await getDb()<OrderRow>(ORDERS).where({ id: orderId }).first();
  // Same "not found" for a missing order and one owned by someone else —
  // never leak whether an order id exists to a non-owner (mirrors
  // orders.service.ts's getOwnOrderById).
  if (!order || order.customer_id !== customerId) throw new NotFoundError("Order not found.");
  return order;
}

/**
 * Creates a fresh Razorpay Order (test mode) for an existing backend order
 * and records a new `payments` attempt row for it. The amount is read ONLY
 * from the order's own `total` column — already computed and snapshotted
 * server-side at order-creation time (orders.service.ts createOrder) — so
 * there is nothing for a client to submit here that this function would
 * need to trust. A new attempt (and a new payments row) is created on every
 * call, which is what makes retrying after a cancelled/failed attempt safe:
 * the old row is simply left in whatever terminal state it reached.
 */
export async function createRazorpayOrderForOrder(customerId: string, orderId: string): Promise<RazorpayOrderResponseDto> {
  const order = await loadOwnOrder(customerId, orderId);
  if (order.payment_status === "paid") {
    throw new ConflictError("This order has already been paid for.");
  }

  const amountPaise = Math.round(Number(order.total) * 100);
  const razorpay = getRazorpayClient();

  // Narrowly typed to just the one field this function actually uses --
  // avoids relying on ReturnType<typeof razorpay.orders.create>, which
  // resolves to the SDK's callback overload (returning void) rather than
  // the Promise overload actually being called below.
  let rzOrder: { id: string };
  try {
    rzOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: order.order_number,
      notes: { orderId: order.id },
    });
  } catch (err) {
    // The Razorpay SDK throws a plain `{ statusCode, error }` object (not
    // an Error instance) on any API-level failure -- most commonly bad
    // credentials (401) in dev/test setup. Logging it here, with context,
    // is what step 1 of debugging a Razorpay failure means in practice:
    // this is the "exact error" to look for in the backend terminal.
    // Never log env.RAZORPAY_KEY_ID/KEY_SECRET themselves.
    const gatewayError = err as { statusCode?: number; error?: { code?: string; description?: string } };
    logger.error(
      { orderId: order.id, statusCode: gatewayError?.statusCode, razorpayError: gatewayError?.error },
      "razorpay_order_create_failed"
    );
    throw new AppError(
      502,
      "INTERNAL_ERROR",
      "The payment gateway rejected the request. This usually means the test-mode Razorpay credentials in backend/.env " +
        "are missing, wrong, or belong to a different provider -- check the backend logs for \"razorpay_order_create_failed\" and verify RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET."
    );
  }

  await getDb()<PaymentRow>(PAYMENTS).insert({
    id: randomUUID(),
    order_id: order.id,
    amount: order.total,
    status: "initiated",
    provider: "razorpay",
    provider_reference: rzOrder.id,
    gateway_payment_reference: null,
    idempotency_key: randomUUID(),
  } as unknown as PaymentRow);

  return {
    keyId: env.RAZORPAY_KEY_ID!,
    razorpayOrderId: rzOrder.id,
    amount: amountPaise,
    currency: "INR",
    orderId: order.id,
    orderNumber: order.order_number,
  };
}

/**
 * The one place an order is EVER marked paid. Recomputes the expected
 * HMAC-SHA256 signature from the Razorpay order id + payment id using the
 * secret key (server-side only) and compares it, in constant time, to what
 * the frontend submitted — exactly Razorpay's documented verification
 * recipe. The frontend's `handler` callback firing is never itself treated
 * as proof of payment; only a signature that checks out here is.
 */
export async function verifyRazorpayPayment(
  customerId: string,
  orderId: string,
  input: RazorpayVerifyInput
): Promise<PaymentVerifyResultDto> {
  const order = await loadOwnOrder(customerId, orderId);

  // Idempotent: a duplicate handler firing (double-click, re-render) on an
  // order already marked paid is a safe no-op, not an error.
  if (order.payment_status === "paid") {
    return { paymentStatus: order.payment_status, orderId: order.id };
  }

  const payment = await getDb()<PaymentRow>(PAYMENTS)
    .where({ order_id: order.id, provider: "razorpay", provider_reference: input.razorpay_order_id })
    .orderBy("created_at", "desc")
    .first();
  if (!payment) {
    throw new ConflictError("No matching payment attempt was found for this order.");
  }

  if (!env.RAZORPAY_KEY_SECRET) {
    throw new AppError(503, "INTERNAL_ERROR", "The payment gateway is not configured.");
  }
  const expectedSignature = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
    .digest("hex");

  const expected = Buffer.from(expectedSignature, "utf8");
  const actual = Buffer.from(input.razorpay_signature, "utf8");
  const signatureValid = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!signatureValid) {
    await getDb()<PaymentRow>(PAYMENTS).where({ id: payment.id }).update({ status: "failed" });
    logger.warn({ orderId: order.id, paymentId: payment.id }, "razorpay_signature_verification_failed");
    throw new ValidationError("Payment verification failed — the payment signature did not match.");
  }

  await getDb().transaction(async (trx) => {
    await trx<PaymentRow>(PAYMENTS)
      .where({ id: payment.id })
      .update({ status: "succeeded", gateway_payment_reference: input.razorpay_payment_id });
    await trx<OrderRow>(ORDERS).where({ id: order.id }).update({ payment_status: "paid" } as Partial<OrderRow>);
  });

  return { paymentStatus: "paid", orderId: order.id };
}

/**
 * Reports a client-observed cancellation/failure (the Razorpay modal was
 * dismissed, or its own `payment.failed` event fired) — can only move a
 * payment attempt that is still `initiated` to `failed`. There is nothing
 * for the frontend to lie about here in a way that matters: this can never
 * mark anything as paid, only stop a stale attempt from sitting as
 * `initiated` forever, so the customer can retry cleanly.
 */
export async function markRazorpayPaymentFailed(customerId: string, orderId: string, razorpayOrderId: string): Promise<void> {
  const order = await loadOwnOrder(customerId, orderId);
  await getDb()<PaymentRow>(PAYMENTS)
    .where({ order_id: order.id, provider: "razorpay", provider_reference: razorpayOrderId, status: "initiated" })
    .update({ status: "failed" });
}

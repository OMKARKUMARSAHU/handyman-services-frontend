import { z } from "zod";

export const orderIdParamsSchema = z.object({ id: z.string().uuid() });

/**
 * Body for `POST /customer/orders/:id/payment/razorpay-verify`. These three
 * fields are exactly what Razorpay Checkout's `handler` callback hands the
 * frontend on a completed payment — nothing here carries an amount or a
 * success/failure claim; the backend independently verifies the signature
 * (payments.service.ts) and only THEN updates anything. See requirement:
 * never mark an order paid because the frontend said so.
 */
export const razorpayVerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * Body for `POST /customer/orders/:id/payment/razorpay-failed` — reports a
 * client-observed cancellation/failure (the user closed the Razorpay modal,
 * or Razorpay's own `payment.failed` event fired). This can only ever move
 * a payments row from `initiated` to `failed` (payments.service.ts) — it
 * can never mark anything as paid, so trusting the frontend here carries no
 * risk of a fake "payment succeeded" state.
 */
export const razorpayFailedSchema = z.object({
  razorpayOrderId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

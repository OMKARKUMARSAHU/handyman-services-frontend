export type PaymentStatus = "initiated" | "succeeded" | "failed" | "refunded";

export interface PaymentRow {
  id: string;
  order_id: string;
  amount: string;
  status: PaymentStatus;
  provider: string | null;
  /** The gateway's ORDER-level reference for this attempt (Razorpay Order id, `order_xxx`) — set at creation. */
  provider_reference: string | null;
  /** The gateway's PAYMENT-level reference (Razorpay Payment id, `pay_xxx`) — set only once verified. */
  gateway_payment_reference: string | null;
  idempotency_key: string;
  created_at: string | Date;
}

/** What `POST /customer/orders/:id/payment/razorpay-order` returns — everything Razorpay Checkout (frontend) needs to open the widget. `keyId` is the PUBLIC key id (safe to expose to a browser by design — it is not the secret); the secret never leaves the backend. */
export interface RazorpayOrderResponseDto {
  keyId: string;
  razorpayOrderId: string;
  /** Smallest currency unit (paise) — what Razorpay Checkout itself expects. */
  amount: number;
  currency: "INR";
  orderId: string;
  orderNumber: string;
}

export interface RazorpayVerifyInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentVerifyResultDto {
  paymentStatus: string;
  orderId: string;
}

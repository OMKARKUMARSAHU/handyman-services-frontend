/**
 * Thin client-side wrapper around Razorpay Checkout (TEST MODE) --
 * https://checkout.razorpay.com/v1/checkout.js is a widget script Razorpay
 * hosts, not an npm package; this loads it once (idempotent, cached
 * promise) and exposes a typed `openRazorpayCheckout()` instead of using
 * the untyped `window.Razorpay` global directly everywhere it is needed.
 *
 * This file never touches the Razorpay Key Secret -- only the PUBLIC key
 * id (RazorpayOrderResponse.keyId from the backend) is ever used here, and
 * "success" from this widget is never trusted on its own: every call site
 * must still send the handler's payload to the backend's
 * `/payment/razorpay-verify` endpoint before treating the order as paid.
 */

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpaySuccessPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailurePayload {
  error: {
    code: string;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccessPayload) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailurePayload) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Injects the Razorpay Checkout script at most once per page load; safe to call from multiple places. */
export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay Checkout is only available in the browser."));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load the Razorpay Checkout script.")));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the Razorpay Checkout script."));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export interface OpenRazorpayCheckoutInput {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (payload: RazorpaySuccessPayload) => void;
  onFailure: (payload: RazorpayFailurePayload) => void;
  onDismiss: () => void;
}

/** Loads the script if needed, then opens the Checkout widget. Every outcome (success/failure/dismiss) is routed to the caller -- nothing here decides payment status itself. */
export async function openRazorpayCheckout(input: OpenRazorpayCheckoutInput): Promise<void> {
  await loadRazorpayCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay Checkout failed to load.");

  const rzp = new window.Razorpay({
    key: input.keyId,
    amount: input.amount,
    currency: input.currency,
    order_id: input.razorpayOrderId,
    name: "Handyman Services",
    description: `Order ${input.orderNumber}`,
    prefill: input.prefill,
    theme: { color: "#0f766e" },
    handler: (response) => input.onSuccess(response),
    modal: { ondismiss: () => input.onDismiss() },
  });
  rzp.on("payment.failed", (response) => input.onFailure(response));
  rzp.open();
}

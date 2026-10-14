"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { AuthApiError } from "@/lib/auth/api";
import { formatINR } from "@/lib/format";
import { openRazorpayCheckout, type RazorpayFailurePayload, type RazorpaySuccessPayload } from "@/lib/payments/razorpay";
import { createShopRazorpayOrder, markShopPaymentFailed, verifyShopRazorpayPayment } from "@/lib/shop/api";
import type { ShopOrder } from "@/lib/shop/types";

type PayState = "idle" | "opening" | "verifying" | "failed" | "cancelled";

/**
 * Pays an existing `pending_payment` shop order via Razorpay (test mode).
 * The widget's success callback is never trusted: the order only becomes paid
 * after the backend verifies the signature (`/razorpay-verify`) — or its own
 * webhook does. Failure / dismiss are reported to the backend so the attempt is
 * closed and the customer can retry.
 */
export function ShopPaymentPanel({
  order,
  customerName,
  customerEmail,
  onPaid,
}: {
  order: ShopOrder;
  customerName?: string;
  customerEmail?: string | null;
  onPaid: () => void;
}) {
  const [state, setState] = useState<PayState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const lastRzOrder = useRef<string | null>(null);
  // Only claim "test mode" when the gateway key actually is a test key (known once the gateway order is created).
  const [testMode, setTestMode] = useState(false);

  async function pay() {
    setState("opening");
    setMessage(null);
    try {
      const rz = await createShopRazorpayOrder(order.id);
      lastRzOrder.current = rz.razorpayOrderId;
      setTestMode(rz.keyId.startsWith("rzp_test_"));
      await openRazorpayCheckout({
        keyId: rz.keyId,
        razorpayOrderId: rz.razorpayOrderId,
        amount: rz.amount,
        currency: rz.currency,
        orderNumber: rz.orderNumber,
        prefill: { name: customerName, email: customerEmail ?? undefined },
        onSuccess: (p: RazorpaySuccessPayload) => void verify(p),
        onFailure: (p: RazorpayFailurePayload) => void fail(p.error.description || "The payment failed."),
        onDismiss: () => void dismiss(),
      });
    } catch (err) {
      setState("failed");
      setMessage(err instanceof AuthApiError ? err.message : "Could not start the payment. Please try again.");
    }
  }

  async function verify(p: RazorpaySuccessPayload) {
    setState("verifying");
    try {
      await verifyShopRazorpayPayment(order.id, p);
      onPaid();
    } catch (err) {
      setState("failed");
      setMessage(
        err instanceof AuthApiError
          ? err.message
          : "We could not confirm this payment yet. If money was deducted it will be reconciled automatically — please refresh this page in a minute before retrying."
      );
    }
  }
  async function fail(reason: string) {
    if (lastRzOrder.current) await markShopPaymentFailed(order.id, lastRzOrder.current).catch(() => {});
    setState("failed");
    setMessage(reason);
  }
  async function dismiss() {
    if (lastRzOrder.current) await markShopPaymentFailed(order.id, lastRzOrder.current).catch(() => {});
    setState("cancelled");
    setMessage("Payment was cancelled. Your items are still held for a short time — you can retry below.");
  }

  const busy = state === "opening" || state === "verifying";
  return (
    <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
      <p className="text-sm text-neutral-700">
        Complete payment to confirm order <span className="font-semibold">{order.orderNumber}</span>. Amount payable:{" "}
        <span className="font-bold">{formatINR(order.total)}</span>
      </p>
      {order.paymentStatus === "failed" && state === "idle" && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          The last payment attempt did not go through. You can try again.
        </p>
      )}
      {message && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </p>
      )}
      <Button type="button" size="lg" className="w-full" onClick={pay} disabled={busy}>
        {state === "opening" ? "Opening Razorpay…" : state === "verifying" ? "Confirming payment…" : state === "idle" ? `Pay ${formatINR(order.total)}` : "Retry payment"}
      </Button>
      <p className="text-xs text-neutral-500">
        {testMode
          ? "Razorpay Test Mode — no real money is charged."
          : "Payments are processed securely by Razorpay. Card details never touch our servers."}
      </p>
    </div>
  );
}

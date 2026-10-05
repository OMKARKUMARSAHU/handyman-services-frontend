"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatINR } from "@/lib/format";
import { openRazorpayCheckout, type RazorpayFailurePayload, type RazorpaySuccessPayload } from "@/lib/payments/razorpay";
import {
  AuthApiError,
  createRazorpayOrder,
  markRazorpayPaymentFailed,
  verifyRazorpayPayment,
  type CustomerOrder,
} from "@/lib/customer/api";

type PaymentState = "idle" | "opening" | "verifying" | "succeeded" | "failed" | "cancelled";

/**
 * The payment step of checkout -- shown only once a real backend order
 * already exists (checkout/page.tsx creates it before rendering this).
 * Every amount shown/charged here is `order.total`, exactly what the
 * backend itself computed at order-creation time; nothing here can
 * override it. A click on "Pay" asks the backend for a fresh Razorpay
 * Order (TEST MODE) tied to that order, opens Razorpay Checkout, and
 * routes every outcome -- success, failure, or the user closing the
 * widget -- back through the backend: success is NEVER accepted just
 * because the widget said so, only once `/payment/razorpay-verify` has
 * independently confirmed the signature.
 */
export function PaymentStep({
  order,
  customerName,
  customerEmail,
  onPaid,
}: {
  order: CustomerOrder;
  customerName?: string;
  customerEmail?: string | null;
  onPaid: () => void;
}) {
  const [state, setState] = useState<PaymentState>(order.paymentStatus === "paid" ? "succeeded" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const lastRazorpayOrderId = useRef<string | null>(null);

  async function handlePay() {
    setState("opening");
    setMessage(null);
    try {
      const rzOrder = await createRazorpayOrder(order.id);
      lastRazorpayOrderId.current = rzOrder.razorpayOrderId;

      await openRazorpayCheckout({
        keyId: rzOrder.keyId,
        razorpayOrderId: rzOrder.razorpayOrderId,
        amount: rzOrder.amount,
        currency: rzOrder.currency,
        orderNumber: rzOrder.orderNumber,
        prefill: { name: customerName, email: customerEmail ?? undefined },
        onSuccess: (payload: RazorpaySuccessPayload) => {
          void handleVerify(payload);
        },
        onFailure: (payload: RazorpayFailurePayload) => {
          void handleFailure(payload.error.description || "The payment failed.");
        },
        onDismiss: () => {
          void handleDismiss();
        },
      });
    } catch (err) {
      setState("failed");
      setMessage(err instanceof AuthApiError ? err.message : "Could not start the payment. Please try again.");
    }
  }

  async function handleVerify(payload: RazorpaySuccessPayload) {
    setState("verifying");
    try {
      await verifyRazorpayPayment(order.id, payload);
      setState("succeeded");
      onPaid();
    } catch (err) {
      setState("failed");
      setMessage(
        err instanceof AuthApiError
          ? err.message
          : "We could not confirm this payment. If any amount was deducted, it will be refunded automatically by Razorpay in test mode -- please retry."
      );
    }
  }

  async function handleFailure(reason: string) {
    if (lastRazorpayOrderId.current) {
      await markRazorpayPaymentFailed(order.id, lastRazorpayOrderId.current, reason).catch(() => {});
    }
    setState("failed");
    setMessage(reason);
  }

  async function handleDismiss() {
    if (lastRazorpayOrderId.current) {
      await markRazorpayPaymentFailed(order.id, lastRazorpayOrderId.current, "Cancelled by customer").catch(() => {});
    }
    setState("cancelled");
    setMessage("Payment was cancelled.");
  }

  if (state === "succeeded") {
    return (
      <div className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800" role="status">
        Payment received. Redirecting to your order confirmation…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm text-neutral-600">
          Order <span className="font-semibold text-neutral-900">{order.orderNumber}</span> has been created. Complete
          payment to confirm your booking.
        </p>
        <div className="mt-3 flex items-center justify-between text-sm font-bold text-neutral-900">
          <span>Amount payable</span>
          <span>{formatINR(order.total)}</span>
        </div>
        <p className="mt-2 text-xs text-neutral-400">Razorpay Test Mode — no real money is charged.</p>
      </div>

      {(state === "failed" || state === "cancelled") && message && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={handlePay}
        disabled={state === "opening" || state === "verifying"}
      >
        {state === "opening" && "Opening Razorpay…"}
        {state === "verifying" && "Confirming payment…"}
        {(state === "idle" || state === "failed" || state === "cancelled") &&
          (state === "idle" ? `Pay ${formatINR(order.total)} with Razorpay` : "Retry payment")}
      </Button>
    </div>
  );
}

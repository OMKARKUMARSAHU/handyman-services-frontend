"use client";

import { useState } from "react";
import type { CustomerAddress, CustomerCart } from "@/lib/customer/api";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/Button";

export function OrderSummaryStep({
  cart,
  address,
  scheduledDate,
  scheduledSlot,
  onBack,
  onConfirm,
  submitting,
  errorMessage,
}: {
  cart: CustomerCart;
  address: CustomerAddress;
  scheduledDate: string;
  scheduledSlot: string;
  onBack: () => void;
  onConfirm: () => void;
  submitting: boolean;
  errorMessage: string | null;
}) {
  const [consent, setConsent] = useState(false);
  const availableItems = cart.items.filter((i) => i.isAvailable);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Services</h3>
        <ul className="space-y-2">
          {availableItems.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-neutral-800">
                {item.serviceName ?? "Service"} × {item.quantity}
              </span>
              <span className="font-semibold text-neutral-900">{formatINR(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {cart.items.length > availableItems.length && (
          <p className="mt-2 text-xs text-amber-600">
            Some items in your cart are no longer available and will not be included in this order.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Address</h3>
        <p className="text-sm text-neutral-800">
          {address.line1}
          {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} — {address.pincode}
        </p>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Schedule</h3>
        <p className="text-sm text-neutral-800">
          {scheduledDate}
          {scheduledSlot ? ` — ${scheduledSlot}` : " — no time-of-day preference"}
        </p>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Payment</h3>
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          You will pay securely via Razorpay on the next step. Your card/UPI details are handled entirely by
          Razorpay — this site never sees them.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2.5 text-sm font-bold text-neutral-900">
        <span>Total</span>
        <span>{formatINR(cart.subtotal)}</span>
      </div>

      <label className="flex items-start gap-2 text-xs text-neutral-600">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        I agree to be contacted by phone/WhatsApp to confirm this booking.
      </label>

      {errorMessage && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="button" size="lg" onClick={onConfirm} disabled={!consent || submitting || availableItems.length === 0}>
          {submitting ? "Placing order…" : "Confirm & Pay"}
        </Button>
      </div>
    </div>
  );
}

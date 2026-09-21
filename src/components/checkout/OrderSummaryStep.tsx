"use client";

import { useState } from "react";
import type { Address, CartItem } from "@/types";
import { getServiceByIdSync } from "@/lib/data/services";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/Button";

export function OrderSummaryStep({
  items,
  address,
  scheduledDate,
  scheduledSlot,
  subtotal,
  onBack,
  onConfirm,
  submitting,
  errorMessage,
}: {
  items: CartItem[];
  address: Address;
  scheduledDate: string;
  scheduledSlot: string;
  subtotal: number;
  onBack: () => void;
  onConfirm: () => void;
  submitting: boolean;
  errorMessage: string | null;
}) {
  const [consent, setConsent] = useState(false);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Services</h3>
        <ul className="space-y-2">
          {items.map((item) => {
            const service = getServiceByIdSync(item.serviceId);
            return (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-800">
                  {service ? service.name : "Service no longer available"} × {item.quantity}
                </span>
                <span className="font-semibold text-neutral-900">
                  {formatINR(item.unitPriceAtAdd * item.quantity)}
                </span>
              </li>
            );
          })}
        </ul>
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
          No online payment yet — a payment gateway has not been selected (Phase 1 §18, still TBD).
          You will pay the technician directly once the visit is confirmed.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2.5 text-sm font-bold text-neutral-900">
        <span>Total</span>
        <span>{formatINR(subtotal)}</span>
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
        <Button type="button" size="lg" onClick={onConfirm} disabled={!consent || submitting}>
          {submitting ? "Placing request…" : "Confirm booking"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Address } from "@/types";
import { Button } from "@/components/ui/Button";

const FIELD_CLASS =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function AddressStep({
  initial,
  onContinue,
}: {
  initial: Address | null;
  onContinue: (address: Address) => void;
}) {
  const [line1, setLine1] = useState(initial?.line1 ?? "");
  const [line2, setLine2] = useState(initial?.line2 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [pincode, setPincode] = useState(initial?.pincode ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!line1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setError("Please fill in address line, city, state and pincode.");
      return;
    }
    setError(null);
    onContinue({
      id: initial?.id ?? `addr-${Date.now()}`,
      customerId: null,
      label: initial?.label ?? "Delivery address",
      line1: line1.trim(),
      line2: line2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isDefault: false,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="addr-line1" className="mb-1.5 block text-sm font-medium text-neutral-800">
          Address line 1
        </label>
        <input id="addr-line1" required value={line1} onChange={(e) => setLine1(e.target.value)} className={FIELD_CLASS} />
      </div>
      <div>
        <label htmlFor="addr-line2" className="mb-1.5 block text-sm font-medium text-neutral-800">
          Address line 2 (optional)
        </label>
        <input id="addr-line2" value={line2} onChange={(e) => setLine2(e.target.value)} className={FIELD_CLASS} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="addr-city" className="mb-1.5 block text-sm font-medium text-neutral-800">
            City
          </label>
          <input id="addr-city" required value={city} onChange={(e) => setCity(e.target.value)} className={FIELD_CLASS} />
        </div>
        <div>
          <label htmlFor="addr-state" className="mb-1.5 block text-sm font-medium text-neutral-800">
            State
          </label>
          <input id="addr-state" required value={state} onChange={(e) => setState(e.target.value)} className={FIELD_CLASS} />
        </div>
        <div>
          <label htmlFor="addr-pincode" className="mb-1.5 block text-sm font-medium text-neutral-800">
            Pincode
          </label>
          <input
            id="addr-pincode"
            required
            inputMode="numeric"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        Continue to schedule
      </Button>
    </form>
  );
}

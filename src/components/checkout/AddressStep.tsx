"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  AuthApiError,
  createMyAddress,
  listMyAddresses,
  type AddressInput,
  type CustomerAddress,
} from "@/lib/customer/api";

const FIELD_CLASS =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/**
 * Picks (or creates) a REAL saved address — `POST /customer/orders` takes
 * only an `addressId`, never a loose address object (orders.schema.ts
 * createOrderSchema), so this step's whole job is producing a real
 * CustomerAddress id to hand to the parent, backed by the customer's
 * actual `/customer/addresses` records.
 */
export function AddressStep({
  initialAddressId,
  onContinue,
}: {
  initialAddressId: string | null;
  onContinue: (addressId: string, address: CustomerAddress) => void;
}) {
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialAddressId);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState("Home");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  useEffect(() => {
    let cancelled = false;
    listMyAddresses()
      .then((list) => {
        if (cancelled) return;
        setAddresses(list);
        if (!selectedId) {
          const preferred = list.find((a) => a.isDefault) ?? list[0];
          if (preferred) setSelectedId(preferred.id);
        }
        if (list.length === 0) setShowForm(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof AuthApiError ? err.message : "Could not load your saved addresses.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!line1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setError("Please fill in address line, city, state and pincode.");
      return;
    }
    setError(null);
    setSaving(true);
    const input: AddressInput = {
      label: label.trim() || "Address",
      line1: line1.trim(),
      line2: line2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isDefault: (addresses?.length ?? 0) === 0,
    };
    try {
      const created = await createMyAddress(input);
      setSaving(false);
      setAddresses((prev) => [...(prev ?? []), created]);
      onContinue(created.id, created);
    } catch (err) {
      setSaving(false);
      setError(err instanceof AuthApiError ? err.message : "Could not save this address. Please try again.");
    }
  }

  function handleContinueWithSelected() {
    const chosen = addresses?.find((a) => a.id === selectedId);
    if (!chosen) {
      setError("Please choose or add a delivery address.");
      return;
    }
    onContinue(chosen.id, chosen);
  }

  if (loadError) {
    return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>;
  }

  if (addresses === null) {
    return <p className="text-sm text-neutral-500">Loading your saved addresses…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {addresses.length > 0 && !showForm && (
        <div className="space-y-3">
          <ul className="space-y-2">
            {addresses.map((addr) => (
              <li key={addr.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3.5 text-sm hover:border-brand-400">
                  <input
                    type="radio"
                    name="address"
                    className="mt-1"
                    checked={selectedId === addr.id}
                    onChange={() => setSelectedId(addr.id)}
                  />
                  <span>
                    <span className="block font-semibold text-neutral-900">{addr.label}</span>
                    <span className="block text-neutral-600">
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} — {addr.pincode}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            + Add a new address
          </button>
          <Button type="button" size="lg" className="w-full sm:w-auto" onClick={handleContinueWithSelected}>
            Continue to schedule
          </Button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAddAddress} className="space-y-4">
          <div>
            <label htmlFor="addr-label" className="mb-1.5 block text-sm font-medium text-neutral-800">
              Label (e.g. Home, Office)
            </label>
            <input id="addr-label" value={label} onChange={(e) => setLabel(e.target.value)} className={FIELD_CLASS} />
          </div>
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
          <div className="flex gap-3">
            {addresses.length > 0 && (
              <Button type="button" variant="outline" size="lg" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Saving…" : "Save and continue"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

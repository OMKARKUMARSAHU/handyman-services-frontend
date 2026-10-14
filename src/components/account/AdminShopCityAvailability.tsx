"use client";

import { useEffect, useState } from "react";
import { formatINR } from "@/lib/format";
import { getAdminShopCityPricing, getAdminShopProductCities } from "@/lib/admin/shop-api";

export interface CityRow {
  cityId: string;
  name: string;
  state: string;
  available: boolean;
  /** Text so the admin can clear it; "" = use the base price adjusted by the city %. */
  priceOverride: string;
  adjustPercent: number;
}

const inputClasses =
  "w-28 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Computes what a customer in the city would pay, mirroring the server rule (override beats the % adjustment). */
export function cityPreviewPrice(basePrice: number, row: CityRow): number | null {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return null;
  const ov = row.priceOverride.trim();
  if (ov !== "") {
    const n = Number(ov);
    return Number.isFinite(n) ? n : null;
  }
  return Math.round(basePrice * (1 + row.adjustPercent / 100) * 100) / 100;
}

/**
 * "Availability by city" editor. Cities with no saved row are available at the
 * base price (plus the city's % adjustment). Unticking a city hides the product
 * there; a price override replaces the base price for that city only.
 * State is owned by the parent form so it is saved together with the product.
 */
export function AdminShopCityAvailability({
  productId,
  basePrice,
  rows,
  onChange,
  onLoaded,
}: {
  productId: string | null;
  basePrice: number;
  rows: CityRow[] | null;
  onChange: (rows: CityRow[]) => void;
  onLoaded: (rows: CityRow[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [bulk, setBulk] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = productId
      ? getAdminShopProductCities(productId).then((list) =>
          list.map<CityRow>((c) => ({ cityId: c.cityId, name: c.name, state: c.state, available: c.available, priceOverride: c.priceOverride == null ? "" : String(c.priceOverride), adjustPercent: c.cityAdjustPercent }))
        )
      : getAdminShopCityPricing().then((list) =>
          list.map<CityRow>((c) => ({ cityId: c.cityId, name: c.name, state: c.state, available: true, priceOverride: "", adjustPercent: c.productPriceAdjustPercent }))
        );
    load
      .then((r) => !cancelled && onLoaded(r))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load cities."));
    return () => {
      cancelled = true;
    };
    // onLoaded is a stable setter wrapper from the parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const update = (cityId: string, patch: Partial<CityRow>) => rows && onChange(rows.map((r) => (r.cityId === cityId ? { ...r, ...patch } : r)));

  return (
    <section aria-labelledby="city-avail-heading">
      <h3 id="city-avail-heading" className="text-sm font-semibold text-neutral-900">
        Availability by city
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Untick a city to hide this product there. Leave the price blank to use the base price (adjusted by the city&rsquo;s % in Shop → Settings). A price entered here replaces the base price for that city.
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {!rows && !error && <p className="mt-2 text-sm text-neutral-500">Loading cities…</p>}
      {rows && rows.length === 0 && <p className="mt-2 text-sm text-neutral-500">No cities are set up yet, so the product is available everywhere.</p>}
      {rows && rows.length > 0 && (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-neutral-50 p-3">
            <div>
              <label htmlFor="city-bulk" className="mb-1 block text-xs font-medium text-neutral-700">
                Set price for all cities (₹)
              </label>
              <input id="city-bulk" className={inputClasses} inputMode="decimal" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="e.g. 24990" />
            </div>
            <button type="button" onClick={() => onChange(rows.map((r) => ({ ...r, priceOverride: bulk.trim() })))} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-100">
              Apply to all
            </button>
            <button type="button" onClick={() => onChange(rows.map((r) => ({ ...r, available: true })))} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-100">
              Available in all
            </button>
            <button type="button" onClick={() => onChange(rows.map((r) => ({ ...r, priceOverride: "" })))} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-100">
              Clear all prices
            </button>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">City price (₹)</th>
                  <th className="px-3 py-2">Customer pays</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rows.map((r) => {
                  const preview = cityPreviewPrice(basePrice, r);
                  return (
                    <tr key={r.cityId}>
                      <td className="px-3 py-2">
                        <span className="font-medium text-neutral-900">{r.name}</span> <span className="text-xs text-neutral-500">{r.state}</span>
                        {r.adjustPercent !== 0 && <span className="ml-1 text-xs text-neutral-400">({r.adjustPercent > 0 ? "+" : ""}{r.adjustPercent}%)</span>}
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" aria-label={`Available in ${r.name}`} checked={r.available} onChange={(e) => update(r.cityId, { available: e.target.checked })} className="h-4 w-4" />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputClasses}
                          inputMode="decimal"
                          aria-label={`Price override for ${r.name}`}
                          value={r.priceOverride}
                          placeholder="Base"
                          disabled={!r.available}
                          onChange={(e) => update(r.cityId, { priceOverride: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-neutral-700">{!r.available ? "—" : preview == null ? "—" : formatINR(preview)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

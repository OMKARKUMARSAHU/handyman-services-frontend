"use client";

import { useEffect, useState } from "react";
import { getAdminShopCityPricing, setAdminShopCityPricing } from "@/lib/admin/shop-api";

const inputClasses =
  "w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Per-city "Product price adjustment %" (e.g. 5 = 5% above the base price in that city; -10 = 10% below). */
export function AdminShopCityPricing({ onFlash }: { onFlash: (m: string | null) => void }) {
  const [rows, setRows] = useState<Array<{ cityId: string; name: string; state: string; value: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdminShopCityPricing()
      .then((list) => !cancelled && setRows(list.map((c) => ({ cityId: c.cityId, name: c.name, state: c.state, value: String(c.productPriceAdjustPercent) }))))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load cities."));
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!rows) return;
    setError(null);
    onFlash(null);
    const payload: Array<{ cityId: string; productPriceAdjustPercent: number }> = [];
    for (const r of rows) {
      const n = r.value.trim() === "" ? 0 : Number(r.value);
      if (!Number.isFinite(n) || n < -90 || n > 500) return setError(`Adjustment for ${r.name} must be a number between -90 and 500.`);
      payload.push({ cityId: r.cityId, productPriceAdjustPercent: n });
    }
    setSaving(true);
    try {
      await setAdminShopCityPricing(payload);
      onFlash("City price adjustments saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save city price adjustments.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-4" aria-labelledby="city-adj-heading">
      <h3 id="city-adj-heading" className="text-sm font-semibold text-neutral-900">
        Product price adjustment by city
      </h3>
      <p className="mt-1 text-xs text-neutral-600">
        Percent added to (or, if negative, taken off) every product&rsquo;s base price in that city. A fixed price set on a product for a city replaces this. Applies to shop products only — it does not change service booking prices.
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {!rows && !error && <p className="mt-2 text-sm text-neutral-500">Loading cities…</p>}
      {rows && rows.length === 0 && <p className="mt-2 text-sm text-neutral-500">No cities are set up yet.</p>}
      {rows && rows.length > 0 && (
        <>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[22rem] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Adjustment %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rows.map((r) => (
                  <tr key={r.cityId}>
                    <td className="px-3 py-2">
                      <span className="font-medium text-neutral-900">{r.name}</span> <span className="text-xs text-neutral-500">{r.state}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputClasses}
                        inputMode="decimal"
                        aria-label={`Price adjustment percent for ${r.name}`}
                        value={r.value}
                        onChange={(e) => setRows((cur) => cur && cur.map((x) => (x.cityId === r.cityId ? { ...x, value: e.target.value } : x)))}
                      />
                      <span className="ml-1 text-neutral-500">%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={saving} onClick={save} className="mt-3 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save city adjustments"}
          </button>
        </>
      )}
    </section>
  );
}

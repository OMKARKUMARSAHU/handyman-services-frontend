"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import type { AdminCity } from "@/lib/admin/catalog-api";
import { hasCustomPrice, validateRow, type CityRows, type CityRowState } from "@/lib/admin/serviceCityPricing";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

type Filter = "all" | "available" | "custom";

function formatBase(value: string): string {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) ? String(n) : "base";
}

/**
 * "City-wise Pricing" section of the Admin service form. Lists EVERY city
 * the city-management system returns (nothing hardcoded), each with its
 * availability checkbox (the existing city-availability setting) and an
 * optional city-specific MRP / offer price. Empty prices mean "use the base
 * price" — the placeholders show the base values to make that visible.
 *
 * Built to stay usable with many cities: a search box, quick filters,
 * a scrollable list with a sticky header, and a "same price for these
 * cities" bulk action that applies to exactly the cities currently listed
 * (so filtering first = applying to a chosen group).
 */
export function ServiceCityPricingEditor({
  cities,
  rows,
  onChange,
  baseMrp,
  baseOfferPrice,
  showErrors,
}: {
  cities: AdminCity[];
  rows: CityRows;
  onChange: (next: CityRows) => void;
  baseMrp: string;
  baseOfferPrice: string;
  /** Show per-row validation messages (set after a failed save attempt, and always for rows the admin has touched). */
  showErrors: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [bulkMrp, setBulkMrp] = useState("");
  const [bulkOffer, setBulkOffer] = useState("");

  const sorted = useMemo(
    () => [...cities].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [cities]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((c) => {
      const row = rows[c.id];
      if (!row) return false;
      if (filter === "available" && !row.available) return false;
      if (filter === "custom" && !hasCustomPrice(row)) return false;
      if (q && !`${c.name} ${c.state}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sorted, rows, query, filter]);

  const customCount = sorted.filter((c) => rows[c.id] && hasCustomPrice(rows[c.id]!)).length;
  const availableCount = sorted.filter((c) => rows[c.id]?.available).length;

  function patch(cityId: string, change: Partial<CityRowState>) {
    const current = rows[cityId];
    if (!current) return;
    onChange({ ...rows, [cityId]: { ...current, ...change } });
  }

  function applyBulk(clear: boolean) {
    const next = { ...rows };
    for (const c of visible) {
      const current = next[c.id];
      if (current) next[c.id] = { ...current, mrp: clear ? "" : bulkMrp, offerPrice: clear ? "" : bulkOffer };
    }
    onChange(next);
  }

  const bulkError = validateRow({ available: true, mrp: bulkMrp, offerPrice: bulkOffer });
  const bulkReady = bulkMrp.trim() !== "" && bulkOffer.trim() !== "" && !bulkError;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: `All (${sorted.length})` },
    { key: "available", label: `Available (${availableCount})` },
    { key: "custom", label: `Custom price (${customCount})` },
  ];

  return (
    <section
      aria-labelledby="city-pricing-heading"
      className="rounded-xl border border-neutral-200 bg-white p-4 sm:col-span-2"
      data-testid="city-wise-pricing"
    >
      <h3 id="city-pricing-heading" className="text-sm font-semibold text-neutral-900">
        City-wise Pricing
      </h3>
      <p className="mt-1 text-xs text-neutral-600">
        The MRP and offer price above are the <strong>base prices</strong> (₹{formatBase(baseMrp)} / ₹{formatBase(baseOfferPrice)}). Set a city&rsquo;s own MRP and offer price below only where it
        should differ — <strong>leave both empty to use the base price</strong> (empty never means ₹0). Tick
        &ldquo;Available&rdquo; to offer this service in that city; setting a price does not make a service available.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            aria-label="Search cities"
            placeholder="Search cities…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${inputClasses} pl-8`}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter cities">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === f.key ? "bg-brand-100 text-brand-700" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-neutral-50 p-3">
        <p className="text-xs font-medium text-neutral-700">Same price for several cities</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Applies to the {visible.length} {visible.length === 1 ? "city" : "cities"} currently listed below — search or filter first to choose a group.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-neutral-600">
            MRP (₹)
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={bulkMrp}
              onChange={(e) => setBulkMrp(e.target.value)}
              className={`${inputClasses} mt-1 w-28`}
            />
          </label>
          <label className="text-xs text-neutral-600">
            Offer price (₹)
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={bulkOffer}
              onChange={(e) => setBulkOffer(e.target.value)}
              className={`${inputClasses} mt-1 w-28`}
            />
          </label>
          <Button type="button" size="md" variant="outline" disabled={!bulkReady || visible.length === 0} onClick={() => applyBulk(false)}>
            Apply to listed cities
          </Button>
          <Button type="button" size="md" variant="outline" disabled={visible.length === 0} onClick={() => applyBulk(true)}>
            Clear prices of listed cities
          </Button>
        </div>
        {bulkError && (bulkMrp.trim() !== "" || bulkOffer.trim() !== "") && <p className="mt-1 text-xs text-red-600">{bulkError}</p>}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No cities exist yet. Add cities in the Cities tab; they will appear here automatically.</p>
      ) : (
        <div className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-neutral-200">
          <div className="sticky top-0 z-10 hidden grid-cols-[minmax(0,1.6fr)_5.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600 sm:grid">
            <span>City</span>
            <span>Available</span>
            <span>City MRP (₹)</span>
            <span>City offer price (₹)</span>
          </div>
          {visible.length === 0 && <p className="px-3 py-4 text-sm text-neutral-500">No cities match.</p>}
          <ul className="divide-y divide-neutral-100">
            {visible.map((c) => {
              const row = rows[c.id]!;
              const error = showErrors || hasCustomPrice(row) ? validateRow(row) : null;
              const custom = hasCustomPrice(row);
              return (
                <li key={c.id} data-city-row={c.name} className="px-3 py-2.5">
                  <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1.6fr)_5.5rem_minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{c.name}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {c.state}
                        {!c.active && <span className="ml-1.5 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">city disabled</span>}
                        {!custom && <span className="ml-1.5 text-neutral-400">· uses base price</span>}
                      </p>
                    </div>
                    <label className="col-span-2 flex items-center gap-2 text-sm text-neutral-700 sm:col-span-1">
                      <input
                        type="checkbox"
                        checked={row.available}
                        onChange={(e) => patch(c.id, { available: e.target.checked })}
                        aria-label={`Available in ${c.name}`}
                      />
                      <span className="sm:sr-only">Available</span>
                    </label>
                    <label className="text-xs text-neutral-500">
                      <span className="mb-0.5 block sm:sr-only">City MRP (₹)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder={baseMrp.trim() ? `Base ${formatBase(baseMrp)}` : "Base"}
                        aria-label={`MRP for ${c.name}`}
                        aria-invalid={Boolean(error)}
                        value={row.mrp}
                        onChange={(e) => patch(c.id, { mrp: e.target.value })}
                        className={`${inputClasses} ${error ? "border-red-400" : ""}`}
                      />
                    </label>
                    <label className="text-xs text-neutral-500">
                      <span className="mb-0.5 block sm:sr-only">City offer price (₹)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder={baseOfferPrice.trim() ? `Base ${formatBase(baseOfferPrice)}` : "Base"}
                        aria-label={`Offer price for ${c.name}`}
                        aria-invalid={Boolean(error)}
                        value={row.offerPrice}
                        onChange={(e) => patch(c.id, { offerPrice: e.target.value })}
                        className={`${inputClasses} ${error ? "border-red-400" : ""}`}
                      />
                    </label>
                  </div>
                  {error && (
                    <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                      {c.name}: {error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

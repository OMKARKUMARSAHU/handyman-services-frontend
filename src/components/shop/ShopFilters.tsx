"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Search + sort + in-stock filter for the listing. State lives in the URL
 * (query string), so every filtered view is shareable, indexable and works
 * with the server-rendered grid; changing any filter resets to page 1.
 */
export function ShopFilters({
  category,
  search,
  sort,
  inStock,
}: {
  category?: string;
  search?: string;
  sort?: string;
  inStock?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(search ?? "");

  function go(next: { q?: string; sort?: string; inStock?: boolean }) {
    const sp = new URLSearchParams();
    if (category) sp.set("category", category);
    const query = next.q ?? q;
    if (query.trim()) sp.set("search", query.trim());
    const s = next.sort ?? sort;
    if (s && s !== "newest") sp.set("sort", s);
    const stock = next.inStock ?? inStock;
    if (stock) sp.set("inStock", "true");
    const qs = sp.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  }

  return (
    <form
      role="search"
      aria-label="Search and filter products"
      onSubmit={(e) => {
        e.preventDefault();
        go({ q });
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <div className="flex flex-1 gap-2">
        <label htmlFor="shop-search" className="sr-only">
          Search products
        </label>
        <input
          id="shop-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products or SKU"
          maxLength={120}
          className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Search
        </button>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={Boolean(inStock)}
            onChange={(e) => go({ inStock: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          In stock only
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <span className="whitespace-nowrap">Sort by</span>
          <select
            value={sort ?? "newest"}
            onChange={(e) => go({ sort: e.target.value })}
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>
    </form>
  );
}

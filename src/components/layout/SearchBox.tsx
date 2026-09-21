"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HeaderModal } from "./HeaderActionModal";
import { getCategories } from "@/lib/data/categories";
import { getAllProductsSync } from "@/lib/data/products";
import { getAllServicesSync } from "@/lib/data/services";
import { getCityBySlugSync } from "@/lib/data/cities";
import { getCategoryById } from "@/lib/data/categories";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Client-side search extended to the marketplace entity set
 * (PHASE_2_SYSTEM_ARCHITECTURE.md §8, PHASE_2_API_CONTRACT.md §3): filters
 * categories/products/services through the same Data Access Layer used
 * everywhere else. Service results (which need a city to link to a real
 * page) only appear once a city is known from the current URL — with no
 * city yet, search still covers categories/products so it's never empty
 * for no reason, and a service match reuses the shared city selector rather
 * than linking to a route that can't resolve.
 *
 * Phase 3 header/footer revision §6: the trigger is now a visible
 * marketplace search bar (placeholder text, not just an icon) so it reads
 * as a first-class header control rather than a hidden utility button —
 * the search/filter logic and results modal below are unchanged.
 */
export function SearchBox({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const params = useParams<{ city?: string }>();
  const citySlug = typeof params?.city === "string" ? params.city : undefined;
  const city = citySlug ? getCityBySlugSync(citySlug) : undefined;

  const categories = useMemo(() => getCategories(), []);
  const products = useMemo(() => getAllProductsSync(), []);
  const services = useMemo(() => getAllServicesSync(), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { categories: [], products: [], services: [] };
    return {
      categories: categories.filter((c) => c.name.toLowerCase().includes(q)),
      products: products.filter((p) => p.name.toLowerCase().includes(q)),
      services: city
        ? services.filter(
            (s) => s.name.toLowerCase().includes(q) && s.availableCityIds.includes(city.id)
          )
        : [],
    };
  }, [query, categories, products, services, city]);

  const hasQuery = query.trim().length > 0;
  const hasResults =
    results.categories.length > 0 || results.products.length > 0 || results.services.length > 0;

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search for a service"
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-500 hover:border-neutral-300 hover:bg-white",
          className
        )}
      >
        <Icon name="search" className="h-4 w-4 shrink-0 text-neutral-400" />
        <span className="truncate">Search for AC service, washing machine repair...</span>
      </button>
      <HeaderModal open={open} onClose={close} title="Search for a service">
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. AC, refrigerator, washing machine"
          className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="mt-3 max-h-72 overflow-y-auto">
          {hasQuery && !hasResults && (
            <p className="py-6 text-center text-sm text-neutral-500">
              No services match &ldquo;{query}&rdquo;.
            </p>
          )}
          {results.services.length > 0 && city && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Services in {city.name}
              </p>
              <ul className="space-y-1">
                {results.services.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/${city.slug}/service/${s.slug}`}
                      onClick={close}
                      className="block rounded-lg px-3 py-2 text-sm text-neutral-800 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.categories.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Categories
              </p>
              <ul className="space-y-1">
                {results.categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={city ? `/${city.slug}/${c.id}` : `/services/${c.id}`}
                      onClick={close}
                      className="block rounded-lg px-3 py-2 text-sm text-neutral-800 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.products.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Products
              </p>
              <ul className="space-y-1">
                {results.products.map((p) => {
                  const category = getCategoryById(p.categoryId);
                  return (
                    <li key={p.id}>
                      <Link
                        href={city ? `/${city.slug}/${p.categoryId}/${p.slug}` : `/services/${p.categoryId}`}
                        onClick={close}
                        className="block rounded-lg px-3 py-2 text-sm text-neutral-800 hover:bg-brand-50 hover:text-brand-700"
                      >
                        {p.name}
                        {category && <span className="text-neutral-400"> — {category.name}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {!hasQuery && (
            <p className="py-6 text-center text-sm text-neutral-500">
              {city
                ? `Start typing to search services in ${city.name}.`
                : "Start typing to search categories and products. Select a city to search services directly."}
            </p>
          )}
        </div>
      </HeaderModal>
    </>
  );
}

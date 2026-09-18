"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HeaderActionButton, HeaderModal } from "./HeaderActionModal";
import { getCategories, getAppliances } from "@/lib/data";

/**
 * Frontend-only search (Phase 4 frontend-polish scope). Filters the
 * existing category/appliance data client-side through the same Data
 * Access Layer used everywhere else — no separate hardcoded result list,
 * and no backend search.
 */
export function SearchBox({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const categories = useMemo(() => getCategories(), []);
  const appliances = useMemo(() => getAppliances(), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { categories: [], appliances: [] };
    return {
      categories: categories.filter((c) => c.name.toLowerCase().includes(q)),
      appliances: appliances.filter((a) => a.name.toLowerCase().includes(q)),
    };
  }, [query, categories, appliances]);

  const hasQuery = query.trim().length > 0;
  const hasResults = results.categories.length > 0 || results.appliances.length > 0;

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <HeaderActionButton
        icon="search"
        label="Search for a service"
        className={className}
        onClick={() => setOpen(true)}
      />
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
          {results.categories.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Categories
              </p>
              <ul className="space-y-1">
                {results.categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/services/${c.id}`}
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
          {results.appliances.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Appliances
              </p>
              <ul className="space-y-1">
                {results.appliances.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/services/${a.categoryId}`}
                      onClick={close}
                      className="block rounded-lg px-3 py-2 text-sm text-neutral-800 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasQuery && (
            <p className="py-6 text-center text-sm text-neutral-500">
              Start typing to search services and appliances.
            </p>
          )}
        </div>
      </HeaderModal>
    </>
  );
}

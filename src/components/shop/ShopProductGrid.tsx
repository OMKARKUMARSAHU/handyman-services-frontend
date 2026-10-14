"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AuthApiError } from "@/lib/auth/api";
import { fetchShopProductsForCity, type ProductListQuery } from "@/lib/shop/api";
import type { PageMeta, ShopProductSummary } from "@/lib/shop/types";
import { useShopCity } from "@/lib/shop/useShopCity";
import { cityKey, classifyHttpStatus, needsFetch, pickCityView, type CityFetchState, type FetchErrorKind } from "@/lib/city/cityView";
import { withRateLimitRetry } from "@/lib/city/retry";
import { cityResultKey, createTtlCache } from "@/lib/city/ttlCache";
import { ShopPagination } from "./ShopPagination";
import { ShopProductCard } from "./ShopProductCard";
import { ShopProductTile } from "./ShopProductTile";

interface Props {
  /** Server-rendered result. Its city is `initialCity` (null = the city-agnostic base view). */
  initialItems: ShopProductSummary[];
  initialMeta: PageMeta;
  /** False when the server-side fetch FAILED — a failure is never rendered as "no products". */
  initialOk?: boolean;
  /** City slug the server rendered for (the /[city] homepage), or null for the base-price, unfiltered view. */
  initialCity?: string | null;
  query: ProductListQuery;
  /** Params for the pagination links (listing page only). */
  paginationParams?: Record<string, string | undefined>;
  showCount?: boolean;
  gridClassName?: string;
  /** "tile" = compact tiles (homepage service box). */
  variant?: "card" | "tile";
  /** Extra last grid item (e.g. the "All Products" tile). */
  trailing?: ReactNode;
}

type Loaded = { items: ShopProductSummary[]; meta: PageMeta };

/** 30s: long enough to flip between cities without re-fetching, short enough that Admin edits show up quickly. */
const resultCache = createTtlCache<Loaded>(30_000);

function errorKindOf(err: unknown): FetchErrorKind {
  return err instanceof AuthApiError ? classifyHttpStatus(err.status) : "failed";
}

/**
 * Product grid for the visitor's selected city.
 *
 * It starts from the server-rendered list and, once the city is known (it lives in the browser), loads that
 * city's list so that products unavailable there disappear and city prices are shown. What it guarantees:
 *  - it never shows another city's (or the base) results as if they were this city's: while a city is loading
 *    it shows placeholders, and results are stored and looked up per city;
 *  - a slow response for an earlier city can never overwrite the current city (aborted + stored per city);
 *  - an API failure is shown as an error with a Retry button — never silently turned into "no products" or
 *    into base-price results; an empty successful response is the only thing that shows the empty message;
 *  - HTTP 429 is retried once, and results are cached for 30s per city so switching back is instant.
 */
export function ShopProductGrid({
  initialItems,
  initialMeta,
  initialOk = true,
  initialCity = null,
  query,
  paginationParams,
  showCount,
  gridClassName,
  variant = "card",
  trailing,
}: Props) {
  const { citySlug, cityName, chooseCity } = useShopCity();
  const queryKey = JSON.stringify(query);
  const resultKey = cityResultKey(citySlug, queryKey);
  const [byKey, setByKey] = useState<Record<string, NonNullable<CityFetchState<Loaded>>>>({});
  const [attempt, setAttempt] = useState(0);
  const mustFetch = needsFetch({ citySlug, initialCity, initialOk });

  useEffect(() => {
    if (!mustFetch) return;
    const key = cityKey(citySlug);
    const cached = attempt === 0 ? resultCache.get(resultKey) : undefined;
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show an already-fetched result for this city immediately
      setByKey((prev) => ({ ...prev, [resultKey]: { key, status: "ok", data: cached } }));
      return;
    }
    const controller = new AbortController();
    const q = { ...(JSON.parse(queryKey) as ProductListQuery), ...(citySlug ? { city: citySlug } : {}) };
    withRateLimitRetry(() => fetchShopProductsForCity(q, { signal: controller.signal }), {
      isRateLimited: (err) => err instanceof AuthApiError && err.status === 429,
      signal: controller.signal,
    })
      .then(({ data, meta }) => {
        if (controller.signal.aborted) return;
        resultCache.set(resultKey, { items: data, meta });
        setByKey((prev) => ({ ...prev, [resultKey]: { key, status: "ok", data: { items: data, meta } } }));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setByKey((prev) => ({ ...prev, [resultKey]: { key, status: "error", kind: errorKindOf(err) } }));
      });
    return () => controller.abort();
  }, [mustFetch, citySlug, queryKey, resultKey, attempt]);

  function retry() {
    resultCache.clear();
    setByKey((prev) => {
      const next = { ...prev };
      delete next[resultKey];
      return next;
    });
    setAttempt((a) => a + 1);
  }

  const view = pickCityView<Loaded>({ citySlug, initialCity, initialOk, fetched: byKey[resultKey] ?? null });
  const where = cityName ?? "your city";
  const isTile = variant === "tile";
  const noteClass = isTile ? "mt-3 text-xs text-neutral-500" : "rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500";
  const trailingBlock = trailing ? <ul className={gridClassName}><li>{trailing}</li></ul> : null;

  if (view.kind === "loading") {
    const count = isTile ? 3 : Math.min(Math.max(initialItems.length, 4), 8);
    return (
      <ul aria-busy="true" aria-label={`Loading products for ${where}`} className={gridClassName ?? "mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={isTile ? "min-h-28 animate-pulse rounded-xl bg-neutral-100" : "h-72 animate-pulse rounded-2xl bg-neutral-100"} />
        ))}
        {trailing && <li>{trailing}</li>}
      </ul>
    );
  }

  if (view.kind === "error") {
    return (
      <>
        <div role="alert" className={noteClass}>
          {view.error === "city_unavailable" ? (
            <>
              Products are not available for the selected city.{" "}
              <button type="button" onClick={chooseCity} className="font-semibold text-brand-700 underline">
                Choose another city
              </button>
            </>
          ) : (
            <>
              {view.error === "rate_limited" ? "Too many requests just now." : `We couldn't load products for ${where}.`}{" "}
              <button type="button" onClick={retry} className="font-semibold text-brand-700 underline">
                Try again
              </button>
            </>
          )}
        </div>
        {trailingBlock}
      </>
    );
  }

  const items = view.kind === "ready" ? view.data.items : initialItems;
  const meta = view.kind === "ready" ? view.data.meta : initialMeta;

  if (items.length === 0) {
    // Only a SUCCESSFUL empty answer reaches here (failures are the error branch above).
    const message = citySlug ? `No products are available in ${where} right now.` : "Products will appear here soon.";
    return (
      <>
        <p className={noteClass}>{message}</p>
        {trailingBlock}
      </>
    );
  }
  return (
    <>
      {showCount && (
        <p className="mt-6 text-sm text-neutral-500" aria-live="polite">
          {meta.total} product{meta.total === 1 ? "" : "s"}
        </p>
      )}
      <ul className={gridClassName ?? "mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"}>
        {items.map((p) => (
          <li key={p.id}>{isTile ? <ShopProductTile product={p} /> : <ShopProductCard product={p} />}</li>
        ))}
        {trailing && <li>{trailing}</li>}
      </ul>
      {paginationParams && <ShopPagination page={meta.page} totalPages={meta.totalPages} params={paginationParams} />}
    </>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchShopProductsForCity, type ProductListQuery } from "@/lib/shop/api";
import type { PageMeta, ShopProductSummary } from "@/lib/shop/types";
import { useShopCity } from "@/lib/shop/useShopCity";
import { ShopPagination } from "./ShopPagination";
import { ShopProductCard } from "./ShopProductCard";
import { ShopProductTile } from "./ShopProductTile";

interface Props {
  /** Server-rendered (base price) result: what search engines and first paint see. */
  initialItems: ShopProductSummary[];
  initialMeta: PageMeta;
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

/**
 * Product grid that starts from the server-rendered list and, once the visitor's
 * city is known (it lives in the browser), refetches so that products unavailable
 * in that city disappear and city prices are shown. On any error it keeps what
 * the server rendered, so the page never goes blank.
 */
export function ShopProductGrid({ initialItems, initialMeta, query, paginationParams, showCount, gridClassName, variant = "card", trailing }: Props) {
  const { citySlug } = useShopCity();
  const [state, setState] = useState<{ city: string | null; items: ShopProductSummary[]; meta: PageMeta } | null>(null);
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    if (!citySlug) return;
    let cancelled = false;
    fetchShopProductsForCity({ ...(JSON.parse(queryKey) as ProductListQuery), city: citySlug })
      .then(({ data, meta }) => {
        if (!cancelled) setState({ city: citySlug, items: data, meta });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [citySlug, queryKey]);

  const live = citySlug && state?.city === citySlug ? state : null;
  const items = live ? live.items : initialItems;
  const meta = live ? live.meta : initialMeta;

  if (items.length === 0 && variant === "tile") {
    return (
      <>
        <p className="mt-3 text-xs text-neutral-500">{live ? "No products are available in your city right now." : "Products will appear here soon."}</p>
        {trailing && <ul className={gridClassName}><li>{trailing}</li></ul>}
      </>
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500">
        {live ? "No products are available in your city right now." : "Products will appear here soon."}
      </p>
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
          <li key={p.id}>{variant === "tile" ? <ShopProductTile product={p} /> : <ShopProductCard product={p} />}</li>
        ))}
        {trailing && <li>{trailing}</li>}
      </ul>
      {paginationParams && <ShopPagination page={meta.page} totalPages={meta.totalPages} params={paginationParams} />}
    </>
  );
}

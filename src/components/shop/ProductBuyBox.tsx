"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatINR } from "@/lib/format";
import { fetchShopProductForCity } from "@/lib/shop/api";
import type { ShopProductDetail } from "@/lib/shop/types";
import { useShopCity } from "@/lib/shop/useShopCity";
import { ProductPurchasePanel } from "./ProductPurchasePanel";
import { ShopCityNotice } from "./ShopCityNotice";
import { displaySku, stockLabel } from "./shopFormat";

type Core = Pick<ShopProductDetail, "id" | "slug" | "sku" | "price" | "mrp" | "discountPercent" | "stockStatus" | "inStock" | "maxOrderQuantity" | "availableInCity" | "isDemo"> & {
  category: { slug: string; name: string };
};

/**
 * Price, availability and the purchase controls for the detail page. The page is
 * server-rendered at the base price (good for SEO); once the visitor's city is
 * known this refetches the city price and availability. A product an admin marked
 * unavailable in the visitor's city cannot be added to the cart here (and the
 * server rejects it again at pricing and at order time).
 */
export function ProductBuyBox({ product }: { product: Core }) {
  const { citySlug, cityName } = useShopCity();
  const [fetched, setFetched] = useState<{ city: string; p: Core } | null>(null);

  useEffect(() => {
    if (!citySlug) return;
    let cancelled = false;
    fetchShopProductForCity(product.slug, citySlug)
      .then((res) => !cancelled && setFetched({ city: citySlug, p: res.product }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [citySlug, product.slug]);

  const p = citySlug && fetched?.city === citySlug ? fetched.p : product;
  const blocked = p.availableInCity === false;
  const stock = stockLabel(p.stockStatus);

  return (
    <>
      <p className="mt-5 flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-extrabold text-neutral-900">{formatINR(p.price)}</span>
        {p.mrp ? <span className="text-lg text-neutral-400 line-through">{formatINR(p.mrp)}</span> : null}
        {p.discountPercent ? <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-bold text-green-800">{p.discountPercent}% off</span> : null}
      </p>
      <p className="mt-1 text-xs text-neutral-500">Inclusive of applicable taxes as set by the seller. Delivery charges, if any, are shown at checkout.</p>
      <ShopCityNotice className="mt-2" />

      <dl className="mt-5 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
        {displaySku(p.sku) && (
          <>
            <dt className="text-neutral-500">SKU</dt>
            <dd className="font-medium text-neutral-800">{displaySku(p.sku)}</dd>
          </>
        )}
        <dt className="text-neutral-500">Availability</dt>
        <dd className={`font-semibold ${blocked ? "text-red-700" : stock.className}`}>{blocked ? `Not available in ${cityName ?? "your city"}` : stock.text}</dd>
        <dt className="text-neutral-500">Category</dt>
        <dd>
          <Link href={`/products?category=${p.category.slug}`} className="font-medium text-brand-700 hover:underline">
            {p.category.name}
          </Link>
        </dd>
      </dl>

      <div className="mt-6 border-t border-neutral-200 pt-6">
        {blocked ? (
          <div role="status" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            This product is not available in {cityName ?? "your city"} yet. Try another city, or browse other products.
          </div>
        ) : (
          <ProductPurchasePanel productId={p.id} inStock={p.inStock} maxQuantity={p.maxOrderQuantity} />
        )}
      </div>
    </>
  );
}

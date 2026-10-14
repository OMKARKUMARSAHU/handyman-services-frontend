"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icons";
import { formatINR } from "@/lib/format";
import { AuthApiError } from "@/lib/auth/api";
import { priceShopCart } from "@/lib/shop/api";
import { useShopCart } from "@/lib/shop/cart";
import type { ShopCartPricing } from "@/lib/shop/types";
import { displayName, displaySku } from "@/components/shop/shopFormat";
import { useShopCity } from "@/lib/shop/useShopCity";
import { ShopCityNotice } from "@/components/shop/ShopCityNotice";

/**
 * The product cart. The browser only knows ids + quantities; names, prices,
 * stock and totals shown here all come from `POST /shop/cart/price`, so what is
 * displayed is exactly what the backend will charge.
 */
export function ShopCartView() {
  const { items, hydrated, setQuantity, removeItem } = useShopCart();
  const { citySlug, chooseCity } = useShopCity();
  const [pricing, setPricing] = useState<ShopCartPricing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  const reprice = useCallback(async (cart: Array<{ productId: string; quantity: number }>, city: string | null) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await priceShopCart(cart, city);
      if (id === reqId.current) setPricing(res);
    } catch (err) {
      if (id === reqId.current) setError(err instanceof AuthApiError ? err.message : "Could not load your cart. Please try again.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset derived server pricing when the cart empties
      setPricing(null);
      return;
    }
    const t = setTimeout(() => void reprice(items, citySlug), 250);
    return () => clearTimeout(t);
  }, [items, hydrated, reprice, citySlug]);

  if (!hydrated) return <p className="py-10 text-center text-sm text-neutral-500">Loading your cart…</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center">
        <Icon name="shopping-cart" className="mx-auto h-10 w-10 text-neutral-300" />
        <p className="mt-3 text-base font-semibold text-neutral-900">Your product cart is empty</p>
        <Link href="/products" className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Browse products
        </Link>
      </div>
    );
  }

  const unavailable = pricing?.lines.filter((l) => !l.available) ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr,22rem]">
      <div>
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{" "}
            <button type="button" className="font-semibold underline" onClick={() => void reprice(items, citySlug)}>
              Retry
            </button>
          </p>
        )}
        <ShopCityNotice className="mb-4" />
        {unavailable.length > 0 && (
          <div role="alert" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Some items need your attention before checkout.{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => unavailable.filter((l) => l.maxOrderQuantity === 0).forEach((l) => removeItem(l.productId))}
            >
              Remove unavailable items
            </button>
          </div>
        )}

        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
          {(pricing?.lines ?? items.map((i) => ({ productId: i.productId, slug: null, name: "Loading…", sku: null, imageUrl: null, unitPrice: 0, quantity: i.quantity, lineTotal: 0, available: true, issue: null, maxOrderQuantity: 20 }))).map((line) => (
            <li key={line.productId} className="flex gap-4 p-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Media Library URL
                  <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-neutral-300">
                    <Icon name="package" className="h-7 w-7" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-neutral-900">
                  {line.slug ? (
                    <Link href={`/products/${line.slug}`} className="hover:text-brand-700">
                      {displayName(line.name)}
                    </Link>
                  ) : (
                    displayName(line.name)
                  )}
                </p>
                {displaySku(line.sku) && <p className="text-xs text-neutral-500">SKU {displaySku(line.sku)}</p>}
                {line.issue && (
                  <p className="mt-1 text-sm font-medium text-red-700">
                    {line.issue}
                    {line.maxOrderQuantity > 0 && line.quantity > line.maxOrderQuantity && (
                      <button type="button" className="ml-2 underline" onClick={() => setQuantity(line.productId, line.maxOrderQuantity)}>
                        Set to {line.maxOrderQuantity}
                      </button>
                    )}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="inline-flex items-center rounded-lg border border-neutral-300">
                    <button type="button" aria-label={`Decrease quantity of ${displayName(line.name)}`} onClick={() => setQuantity(line.productId, line.quantity - 1)} className="h-9 w-9 text-neutral-700 hover:bg-neutral-50">
                      −
                    </button>
                    <span className="w-9 text-center text-sm" aria-live="polite">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${displayName(line.name)}`}
                      disabled={line.quantity >= (line.maxOrderQuantity || 20)}
                      onClick={() => setQuantity(line.productId, line.quantity + 1)}
                      className="h-9 w-9 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <button type="button" onClick={() => removeItem(line.productId)} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-red-600">
                    <Icon name="trash" className="h-4 w-4" /> Remove
                  </button>
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold text-neutral-900">{pricing ? formatINR(line.lineTotal) : "—"}</p>
                {pricing && line.available && line.quantity > 1 && <p className="text-xs text-neutral-500">{formatINR(line.unitPrice)} each</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside aria-label="Order summary" className="h-fit rounded-2xl border border-neutral-200 bg-white p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold text-neutral-900">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd className="font-medium">{pricing ? formatINR(pricing.subtotal) : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">Delivery</dt>
            <dd className="font-medium">{pricing ? (pricing.deliveryCharge > 0 ? formatINR(pricing.deliveryCharge) : "Free") : "—"}</dd>
          </div>
          {pricing && pricing.deliveryCharge > 0 && pricing.freeDeliveryThreshold != null && (
            <p className="text-xs text-neutral-500">Free delivery on orders of {formatINR(pricing.freeDeliveryThreshold)} or more.</p>
          )}
          <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-bold text-neutral-900">
            <dt>Total</dt>
            <dd>{pricing ? formatINR(pricing.total) : "—"}</dd>
          </div>
        </dl>
        {pricing?.cityRequired ? (
          <button type="button" onClick={chooseCity} className="mt-5 w-full rounded-lg bg-brand-600 px-5 py-3 text-base font-semibold text-white hover:bg-brand-700">
            Select city to continue
          </button>
        ) : pricing?.canCheckout ? (
          <Link href="/shop/checkout" className="mt-5 block rounded-lg bg-brand-600 px-5 py-3 text-center text-base font-semibold text-white hover:bg-brand-700">
            Proceed to checkout
          </Link>
        ) : (
          <button type="button" disabled className="mt-5 w-full rounded-lg bg-neutral-200 px-5 py-3 text-base font-semibold text-neutral-500">
            {loading ? "Updating…" : "Fix items to checkout"}
          </button>
        )}
        <Link href="/products" className="mt-3 block text-center text-sm font-medium text-brand-700 hover:underline">
          Continue shopping
        </Link>
        <p className="mt-4 text-xs text-neutral-400">Totals are calculated by our server at checkout.</p>
      </aside>
    </div>
  );
}

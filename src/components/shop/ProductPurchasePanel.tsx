"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useShopCart } from "@/lib/shop/cart";

/**
 * Quantity selector + Add to Cart + Buy Now. The quantity is clamped to the
 * server-provided `maxOrderQuantity`; the real stock check still happens again
 * when the cart is priced and when the order is created.
 */
export function ProductPurchasePanel({ productId, inStock, maxQuantity }: { productId: string; inStock: boolean; maxQuantity: number }) {
  const router = useRouter();
  const { addItem, setQuantity: setCartQuantity, items } = useShopCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const inCart = items.find((i) => i.productId === productId)?.quantity ?? 0;

  if (!inStock || maxQuantity < 1) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="status">
        This product is currently out of stock.
      </div>
    );
  }

  const clamp = (n: number) => Math.max(1, Math.min(maxQuantity, Number.isFinite(n) ? Math.trunc(n) : 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label htmlFor="qty" className="text-sm font-medium text-neutral-700">
          Quantity
        </label>
        <div className="inline-flex items-center rounded-lg border border-neutral-300">
          <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => clamp(q - 1))} disabled={qty <= 1} className="h-10 w-10 text-lg text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
            −
          </button>
          <input
            id="qty"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(clamp(Number(e.target.value.replace(/\D/g, "")) || 1))}
            className="h-10 w-12 border-x border-neutral-300 text-center text-sm focus:outline-none"
            aria-label="Quantity"
          />
          <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => clamp(q + 1))} disabled={qty >= maxQuantity} className="h-10 w-10 text-lg text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
            +
          </button>
        </div>
        {maxQuantity < 20 && <span className="text-xs text-amber-700">Only {maxQuantity} available</span>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            addItem(productId, qty, maxQuantity);
            setAdded(true);
          }}
          className="flex-1 rounded-lg border border-brand-600 bg-white px-6 py-3 text-base font-semibold text-brand-700 hover:bg-brand-50"
        >
          Add to Cart
        </button>
        <button
          type="button"
          onClick={() => {
            // Buy Now = ensure this item is in the cart at the chosen quantity (other cart items stay), then go straight to checkout.
            if (inCart > 0) setCartQuantity(productId, Math.min(maxQuantity, qty));
            else addItem(productId, qty, maxQuantity);
            router.push("/shop/checkout");
          }}
          className="flex-1 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700"
        >
          Buy Now
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-green-700">
        {added ? (
          <>
            Added to your cart.{" "}
            <button type="button" onClick={() => router.push("/shop/cart")} className="font-semibold underline">
              View cart
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}

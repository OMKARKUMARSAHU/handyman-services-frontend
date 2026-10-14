"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useShopCart } from "@/lib/shop/cart";
import { cn } from "@/lib/utils";

/**
 * "Add to Cart" for a product card. Only the product id + quantity go into the
 * cart (the server re-prices everything), and the button is disabled when the
 * product is out of stock so an unavailable item can't be added from the grid.
 */
export function ShopAddToCartButton({
  productId,
  inStock,
  maxQuantity,
  unavailableLabel,
  compact = false,
  className,
}: {
  productId: string;
  inStock: boolean;
  maxQuantity: number;
  /** Shown (disabled) instead of "Out of stock", e.g. "Not available in your city". */
  unavailableLabel?: string;
  /** Small variant for dense tiles: shorter button, "Added" confirmation on the button itself (no extra line). */
  compact?: boolean;
  className?: string;
}) {
  const { addItem, items } = useShopCart();
  const [justAdded, setJustAdded] = useState(false);
  const inCart = items.find((i) => i.productId === productId)?.quantity ?? 0;

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 2500);
    return () => clearTimeout(t);
  }, [justAdded]);

  if (!inStock) {
    return (
      <button type="button" disabled className={cn("w-full rounded-lg bg-neutral-100 text-neutral-400 font-semibold", compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm", className)}>
        {unavailableLabel ?? "Out of stock"}
      </button>
    );
  }
  const atMax = inCart >= maxQuantity;
  if (compact) {
    return (
      <div className={className}>
        <button
          type="button"
          disabled={atMax}
          onClick={() => {
            addItem(productId, 1, maxQuantity);
            setJustAdded(true);
          }}
          className="w-full rounded-lg bg-brand-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {atMax ? "In cart" : justAdded ? "Added ✓" : "Add to Cart"}
        </button>
        <span role="status" aria-live="polite" className="sr-only">
          {justAdded ? "Added to cart." : ""}
        </span>
      </div>
    );
  }
  return (
    <div className={cn("space-y-1", className)}>
      <button
        type="button"
        disabled={atMax}
        onClick={() => {
          addItem(productId, 1, maxQuantity);
          setJustAdded(true);
        }}
        className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {atMax ? "Max quantity in cart" : "Add to Cart"}
      </button>
      <p role="status" aria-live="polite" className="min-h-4 text-center text-xs text-green-700">
        {justAdded ? (
          <>
            Added to cart.{" "}
            <Link href="/shop/cart" className="font-semibold underline">
              View cart
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}

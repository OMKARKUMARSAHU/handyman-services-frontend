"use client";

import Link from "next/link";
import { Icon } from "@/lib/icons";
import { useShopCart } from "@/lib/shop/cart";

/** Link to the product cart with a live item-count badge. */
export function ShopCartLink() {
  const { itemCount, hydrated } = useShopCart();
  const count = hydrated ? itemCount : 0;
  return (
    <Link
      href="/shop/cart"
      aria-label={count > 0 ? `Product cart, ${count} item${count === 1 ? "" : "s"}` : "Product cart"}
      className="relative inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:border-brand-500 hover:text-brand-700"
    >
      <Icon name="shopping-cart" className="h-4 w-4" />
      <span>Cart</span>
      {count > 0 && (
        <span aria-hidden="true" className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

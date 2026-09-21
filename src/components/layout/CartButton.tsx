"use client";

import { useState } from "react";
import { HeaderActionButton } from "./HeaderActionModal";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useCart } from "@/lib/state/CartProvider";

/**
 * Live item-count badge + opens the cart drawer, reading useCart()
 * (PHASE_2_COMPONENT_ARCHITECTURE.md §3).
 */
export function CartButton({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();

  return (
    <>
      <div className="relative">
        <HeaderActionButton
          icon="shopping-cart"
          label={itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}` : "Cart"}
          className={className}
          showLabel={showLabel}
          onClick={() => setOpen(true)}
        />
        {itemCount > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white"
          >
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </div>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

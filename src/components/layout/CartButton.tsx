"use client";

import { useState } from "react";
import Link from "next/link";
import { HeaderActionButton, HeaderModal } from "./HeaderActionModal";

/**
 * Frontend-only cart placeholder (Phase 4 frontend-polish scope). No
 * checkout/order backend exists yet — clicking it shows a clean empty
 * state rather than doing nothing or pretending to hold real items.
 */
export function CartButton({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <HeaderActionButton
        icon="shopping-cart"
        label="Cart"
        className={className}
        showLabel={showLabel}
        onClick={() => setOpen(true)}
      />
      <HeaderModal open={open} onClose={() => setOpen(false)} title="Your cart">
        <p className="text-sm text-neutral-600">Your cart is currently empty.</p>
        <div className="mt-4">
          <Link
            href="/plans"
            onClick={() => setOpen(false)}
            className="block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
          >
            Browse plans
          </Link>
        </div>
      </HeaderModal>
    </>
  );
}

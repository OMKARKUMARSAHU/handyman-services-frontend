"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useCart } from "@/lib/state/CartProvider";
import { Icon } from "@/lib/icons";
import { CartLineItem } from "./CartLineItem";
import { CartSummary } from "./CartSummary";

/**
 * Slide-over cart drawer (PHASE_2_UI_UX_DESIGN.md §8), same accessibility
 * baseline as the existing HeaderModal pattern (role=dialog, aria-modal,
 * Escape-to-close, focus handling kept simple by trapping via overlay click).
 *
 * CART REMOVE BUTTON — CHECKOUT / CART DRAWER VISIBILITY FIX: this used to
 * render inline wherever `CartButton` sits, which is inside `<Header>`.
 * `Header` has `backdrop-blur` (`backdrop-filter: blur(...)`), and per the
 * CSS spec, an ancestor with a non-none `filter`/`backdrop-filter`
 * establishes a new containing block for `position: fixed` descendants —
 * so this drawer's `fixed inset-0` overlay was sizing and positioning
 * itself against the header's own ~64–120px sticky bar instead of the
 * viewport. The header itself rendered fine; everything *below* the
 * header's height (the cart items, their Remove buttons, and — on a short
 * viewport — even the subtotal/checkout footer) was pushed outside that
 * tiny box and effectively unreachable, exactly as reported, on every
 * page (not just `/checkout` — that just happened to be where it was
 * screenshotted).
 *
 * Fixed by portaling the drawer's whole overlay to `document.body`, so it
 * is no longer a DOM descendant of the header and `position: fixed`
 * correctly resolves against the real viewport again. `CartButton` (the
 * header icon + badge) is untouched — only the drawer's rendered output
 * moves; the on-page trigger stays exactly where it was.
 */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart } = useCart();
  const [mounted, setMounted] = useState(false);

  // Portal target must be read after mount (no `document` during SSR) —
  // same one-time mount-detection pattern already used by CartProvider's
  // own hydration effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-neutral-900/40"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-base font-bold text-neutral-900">Your cart</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-neutral-600">Your cart is currently empty.</p>
              <Link
                href="/"
                onClick={onClose}
                className="mt-4 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Browse services
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {cart.items.map((item) => (
                <CartLineItem key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="px-5 pb-5">
            <CartSummary onNavigate={onClose} />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

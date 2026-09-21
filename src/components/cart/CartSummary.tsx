"use client";

import Link from "next/link";
import { useCart } from "@/lib/state/CartProvider";
import { formatINR } from "@/lib/format";
import { Icon } from "@/lib/icons";

export function CartSummary({ onNavigate }: { onNavigate?: () => void }) {
  const { subtotal, itemCount, cityIdsInCart } = useCart();

  return (
    <div className="border-t border-neutral-200 pt-4">
      {cityIdsInCart.length > 1 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <Icon name="shield-check" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This cart has services from more than one city. How checkout should handle that is
            still an open business decision — see PHASE_2_OPEN_QUESTIONS.md #24. Your booking
            request will be reviewed by our team before confirmation.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
        <span>Subtotal ({itemCount} item{itemCount === 1 ? "" : "s"})</span>
        <span>{formatINR(subtotal)}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">Taxes and final total confirmed at checkout.</p>
      <Link
        href="/checkout"
        onClick={onNavigate}
        className="mt-4 block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
      >
        Proceed to Checkout
      </Link>
    </div>
  );
}

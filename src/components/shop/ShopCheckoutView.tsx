"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AddressStep } from "@/components/checkout/AddressStep";
import { Button } from "@/components/ui/Button";
import { AuthApiError } from "@/lib/auth/api";
import type { CustomerAddress } from "@/lib/customer/api";
import { formatINR } from "@/lib/format";
import { createShopOrder, priceShopCart } from "@/lib/shop/api";
import { useShopCart } from "@/lib/shop/cart";
import type { ShopCartPricing } from "@/lib/shop/types";
import { useAuth } from "@/lib/state/AuthProvider";
import { displayName } from "@/components/shop/shopFormat";
import { useShopCity } from "@/lib/shop/useShopCity";
import { ShopCityNotice } from "@/components/shop/ShopCityNotice";

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Checkout: sign in → pick/create a saved address → review server-priced totals
 * → place order. The order is created in `pending_payment` with stock reserved;
 * payment happens on the order page (so an abandoned payment can be resumed
 * later). No price is ever sent to the server — only ids and quantities.
 */
export function ShopCheckoutView() {
  const router = useRouter();
  const { user, status } = useAuth();
  const { items, hydrated, clear } = useShopCart();
  const { citySlug } = useShopCity();
  const [address, setAddress] = useState<CustomerAddress | null>(null);
  const [pricing, setPricing] = useState<ShopCartPricing | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const ready = status === "ready" && user?.role === "customer" && hydrated && items.length > 0;
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    priceShopCart(items, citySlug)
      .then((p) => !cancelled && setPricing(p))
      .catch((err) => !cancelled && setPricingError(err instanceof AuthApiError ? err.message : "Could not price your cart."));
    return () => {
      cancelled = true;
    };
  }, [ready, items, citySlug]);

  async function placeOrder() {
    if (!address || !citySlug || !pricing?.canCheckout) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createShopOrder({ items, addressId: address.id, idempotencyKey, city: citySlug });
      clear();
      router.push(`/shop/orders/${order.id}?pay=1`);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not place your order. Please try again.");
      // Stock/price may have changed under us — refresh what the customer sees.
      priceShopCart(items, citySlug).then(setPricing).catch(() => {});
      setSubmitting(false);
    }
  }

  if (status === "loading" || !hydrated) return <p className="py-10 text-center text-sm text-neutral-500">Preparing your checkout…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="text-sm text-neutral-600">Please log in to check out — your cart will be waiting for you.</p>
        <Button href="/login?next=/shop/checkout" className="mt-4">
          Log in or sign up
        </Button>
      </div>
    );
  }
  if (user.role !== "customer") {
    return <p className="py-10 text-center text-sm text-neutral-600">Staff accounts cannot place customer orders.</p>;
  }
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="text-sm text-neutral-600">Your cart is empty, so there&rsquo;s nothing to check out yet.</p>
        <Link href="/products" className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr,22rem]">
      <div className="space-y-8">
        <section aria-labelledby="addr-heading">
          <h2 id="addr-heading" className="text-lg font-bold text-neutral-900">
            1. Delivery address
          </h2>
          {address ? (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
              <p className="font-semibold text-neutral-900">{address.label}</p>
              <p className="text-neutral-600">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} {address.pincode}
              </p>
              <button type="button" onClick={() => setAddress(null)} className="mt-2 text-sm font-semibold text-brand-700 hover:underline">
                Change address
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <AddressStep initialAddressId={null} continueLabel="Deliver to this address" onContinue={(_id, value) => setAddress(value)} />
            </div>
          )}
        </section>

        <section aria-labelledby="review-heading">
          <h2 id="review-heading" className="text-lg font-bold text-neutral-900">
            2. Review &amp; place order
          </h2>
          {pricingError && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {pricingError}
            </p>
          )}
          {pricing && (
            <ul className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
              {pricing.lines.map((l) => (
                <li key={l.productId} className="flex items-start justify-between gap-4 p-4 text-sm">
                  <div>
                    <p className="font-medium text-neutral-900">{displayName(l.name)}</p>
                    <p className="text-neutral-500">
                      Qty {l.quantity} × {formatINR(l.unitPrice)}
                    </p>
                    {l.issue && <p className="mt-1 font-medium text-red-700">{l.issue}</p>}
                  </div>
                  <p className="font-semibold">{formatINR(l.lineTotal)}</p>
                </li>
              ))}
            </ul>
          )}
          {pricing?.cityRequired && (
            <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Please select your city so we can confirm availability and price. <ShopCityNotice className="mt-1" />
            </p>
          )}
          {pricing && !pricing.cityRequired && !pricing.canCheckout && (
            <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Some items are not available in the requested quantity{citySlug ? " or in your city" : ""}.{" "}
              <Link href="/shop/cart" className="font-semibold underline">
                Update your cart
              </Link>
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}{" "}
              <Link href="/shop/cart" className="font-semibold underline">
                Review cart
              </Link>
            </p>
          )}
        </section>
      </div>

      <aside aria-label="Order summary" className="h-fit rounded-2xl border border-neutral-200 bg-white p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold text-neutral-900">Summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd>{pricing ? formatINR(pricing.subtotal) : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">Delivery</dt>
            <dd>{pricing ? (pricing.deliveryCharge > 0 ? formatINR(pricing.deliveryCharge) : "Free") : "—"}</dd>
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>{pricing ? formatINR(pricing.total) : "—"}</dd>
          </div>
        </dl>
        <Button type="button" size="lg" className="mt-5 w-full" disabled={!address || !pricing?.canCheckout || submitting} onClick={placeOrder}>
          {submitting ? "Placing order…" : "Place order & pay"}
        </Button>
        {!address && <p className="mt-2 text-xs text-neutral-500">Choose a delivery address to continue.</p>}
        {citySlug && <ShopCityNotice className="mt-3 text-xs" />}
        <p className="mt-3 text-xs text-neutral-400">You pay securely on the next step with Razorpay. Stock is held for you while you pay.</p>
      </aside>
    </div>
  );
}

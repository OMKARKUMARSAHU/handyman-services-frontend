"use client";

import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCart } from "@/lib/state/CartProvider";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartSummary } from "@/components/cart/CartSummary";

export default function CartPage() {
  const { cart } = useCart();

  return (
    <>
      <PageHeader heading="Your cart" subheading="Review your selected services before checkout." />
      <section className="py-10 sm:py-14">
        <Container>
          {cart.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
              <p className="text-sm text-neutral-600">Your cart is currently empty.</p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Browse services
              </Link>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-3">
              <ul className="space-y-3 lg:col-span-2">
                {cart.items.map((item) => (
                  <CartLineItem key={item.id} item={item} />
                ))}
              </ul>
              <aside className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 lg:col-span-1">
                <CartSummary />
              </aside>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}

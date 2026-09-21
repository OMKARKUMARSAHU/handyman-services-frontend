"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { CheckoutStepper } from "@/components/checkout/CheckoutStepper";
import { AddressStep } from "@/components/checkout/AddressStep";
import { ScheduleStep } from "@/components/checkout/ScheduleStep";
import { OrderSummaryStep } from "@/components/checkout/OrderSummaryStep";
import { useCart } from "@/lib/state/CartProvider";
import { createOrder } from "@/lib/data/orders";
import type { Address } from "@/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, clearCart } = useCart();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [address, setAddress] = useState<Address | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledSlot, setScheduledSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (cart.items.length === 0) {
    return (
      <>
        <PageHeader heading="Checkout" />
        <section className="py-14">
          <Container className="max-w-lg text-center">
            <p className="text-sm text-neutral-600">
              Your cart is empty, so there&rsquo;s nothing to check out yet.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Browse services
            </Link>
          </Container>
        </section>
      </>
    );
  }

  async function handleConfirm() {
    if (!address) return;
    setSubmitting(true);
    setErrorMessage(null);
    const result = await createOrder({
      items: cart.items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })),
      address,
      scheduledDate,
      scheduledSlot: scheduledSlot || undefined,
      customerId: undefined, // guest checkout — see PHASE_2_OPEN_QUESTIONS.md #17
    });
    setSubmitting(false);
    if (!result.success || !result.order) {
      setErrorMessage(result.message);
      return;
    }
    clearCart();
    router.push(`/order-confirmation/${result.order.id}`);
  }

  return (
    <>
      <PageHeader heading="Checkout" subheading="Address, schedule and summary — no payment is collected yet." />
      <section className="py-10 sm:py-14">
        <Container className="max-w-2xl">
          <div className="mb-8">
            <CheckoutStepper activeStep={step} />
          </div>

          {step === 0 && (
            <AddressStep
              initial={address}
              onContinue={(addr) => {
                setAddress(addr);
                setStep(1);
              }}
            />
          )}

          {step === 1 && (
            <ScheduleStep
              initialDate={scheduledDate}
              initialSlot={scheduledSlot}
              onBack={() => setStep(0)}
              onContinue={(date, slot) => {
                setScheduledDate(date);
                setScheduledSlot(slot);
                setStep(2);
              }}
            />
          )}

          {step === 2 && address && (
            <OrderSummaryStep
              items={cart.items}
              address={address}
              scheduledDate={scheduledDate}
              scheduledSlot={scheduledSlot}
              subtotal={subtotal}
              onBack={() => setStep(1)}
              onConfirm={handleConfirm}
              submitting={submitting}
              errorMessage={errorMessage}
            />
          )}
        </Container>
      </section>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { CheckoutStepper } from "@/components/checkout/CheckoutStepper";
import { AddressStep } from "@/components/checkout/AddressStep";
import { ScheduleStep } from "@/components/checkout/ScheduleStep";
import { OrderSummaryStep } from "@/components/checkout/OrderSummaryStep";
import { PaymentStep } from "@/components/checkout/PaymentStep";
import { useCart } from "@/lib/state/CartProvider";
import { useAuth } from "@/lib/state/AuthProvider";
import {
  AuthApiError,
  createMyOrder,
  getMyCart,
  mergeMyCart,
  type CustomerAddress,
  type CustomerCart,
  type CustomerOrder,
} from "@/lib/customer/api";

function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `co-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Real checkout, wired to the real backend (previously this page only
 * wrote a mock order into localStorage — see PHASE_1 "Razorpay test-mode
 * integration" task). Login-required: `POST /customer/orders` has always
 * required an authenticated customer (orders migration — "an
 * unauthenticated user must not be able to create an order"); this page
 * simply now enforces the same rule the backend already did, instead of
 * faking a guest order that was never real.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { user, status } = useAuth();
  const { cart: localCart, clearCart: clearLocalCart } = useCart();

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [preparing, setPreparing] = useState(true);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [serverCart, setServerCart] = useState<CustomerCart | null>(null);

  const [address, setAddress] = useState<{ id: string; value: CustomerAddress } | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledSlot, setScheduledSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [idempotencyKey] = useState(newIdempotencyKey);

  // Once signed in as a customer, move whatever is in the browser-local
  // cart into the real server cart exactly once (merge is additive —
  // calling it twice with the same items would double the quantities —
  // so the local cart is cleared immediately after a successful merge),
  // then load the authoritative server cart to check out from.
  useEffect(() => {
    if (status !== "ready" || !user || user.role !== "customer") return;
    let cancelled = false;

    async function prepare() {
      setPreparing(true);
      setPrepareError(null);
      try {
        if (localCart.items.length > 0) {
          await mergeMyCart(localCart.items.map((i) => ({ serviceId: i.serviceId, cityId: i.cityId, quantity: i.quantity })));
          if (!cancelled) clearLocalCart();
        }
        const cart = await getMyCart();
        if (!cancelled) setServerCart(cart);
      } catch (err) {
        if (!cancelled) {
          setPrepareError(err instanceof AuthApiError ? err.message : "Could not load your cart. Please try again.");
        }
      } finally {
        if (!cancelled) setPreparing(false);
      }
    }
    void prepare();
    return () => {
      cancelled = true;
    };
    // Intentionally only re-runs when auth state settles — not on every
    // localCart change, since that would re-trigger the merge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user]);

  async function handleConfirm() {
    if (!address) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await createMyOrder({
        addressId: address.id,
        scheduledDate,
        scheduledSlot: scheduledSlot || undefined,
        idempotencyKey,
      });
      setOrder(created);
      setStep(3);
    } catch (err) {
      setErrorMessage(err instanceof AuthApiError ? err.message : "Could not place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center text-sm text-neutral-500">Checking your session…</Container>
      </section>
    );
  }

  if (!user) {
    return (
      <>
        <PageHeader heading="Checkout" />
        <section className="py-14">
          <Container className="max-w-md text-center">
            <p className="text-sm text-neutral-600">Please log in to check out — your cart will be waiting for you.</p>
            <Button href="/login" className="mt-4">
              Log in or sign up
            </Button>
          </Container>
        </section>
      </>
    );
  }

  if (user.role !== "customer") {
    return (
      <>
        <PageHeader heading="Checkout" />
        <section className="py-14">
          <Container className="max-w-md text-center">
            <p className="text-sm text-neutral-600">
              This account ({user.email ?? user.name}) is a Staff account and cannot place customer orders.
            </p>
          </Container>
        </section>
      </>
    );
  }

  if (preparing) {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center text-sm text-neutral-500">Preparing your checkout…</Container>
      </section>
    );
  }

  if (prepareError) {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center">
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {prepareError}
          </p>
        </Container>
      </section>
    );
  }

  if (!serverCart || serverCart.items.filter((i) => i.isAvailable).length === 0) {
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

  return (
    <>
      <PageHeader heading="Checkout" subheading="Address, schedule, summary and secure payment." />
      <section className="py-10 sm:py-14">
        <Container className="max-w-2xl">
          <div className="mb-8">
            <CheckoutStepper activeStep={step} />
          </div>

          {step === 0 && (
            <AddressStep
              initialAddressId={address?.id ?? null}
              onContinue={(addressId, value) => {
                setAddress({ id: addressId, value });
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
              cart={serverCart}
              address={address.value}
              scheduledDate={scheduledDate}
              scheduledSlot={scheduledSlot}
              onBack={() => setStep(1)}
              onConfirm={handleConfirm}
              submitting={submitting}
              errorMessage={errorMessage}
            />
          )}

          {step === 3 && order && (
            <PaymentStep
              order={order}
              customerName={user.name}
              customerEmail={user.email}
              onPaid={() => router.push(`/order-confirmation/${order.id}`)}
            />
          )}
        </Container>
      </section>
    </>
  );
}

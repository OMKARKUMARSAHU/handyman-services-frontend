"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PaymentStep } from "@/components/checkout/PaymentStep";
import { useAuth } from "@/lib/state/AuthProvider";
import { AuthApiError, getMyOrder, type CustomerOrder } from "@/lib/customer/api";
import { formatINR } from "@/lib/format";
import { Icon } from "@/lib/icons";

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  pending_payment: "Payment pending",
  failed: "Payment failed",
};

export default function OrderConfirmationPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = typeof params?.orderId === "string" ? params.orderId : "";
  const { user, status } = useAuth();

  const [order, setOrder] = useState<CustomerOrder | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!orderId) return;
    getMyOrder(orderId)
      .then((result) => setOrder(result))
      .catch((err) => {
        setOrder(null);
        setLoadError(err instanceof AuthApiError ? err.message : "Could not load this order.");
      });
  }, [orderId]);

  useEffect(() => {
    if (status !== "ready" || !user) return;
    load();
  }, [status, user, load]);

  if (status === "loading") {
    return (
      <section className="py-16">
        <Container className="max-w-lg text-center text-sm text-neutral-500">Checking your session…</Container>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center">
          <p className="text-sm text-neutral-600">Please log in to view this order.</p>
          <Button href="/login" className="mt-4">
            Log in or sign up
          </Button>
        </Container>
      </section>
    );
  }

  if (order === undefined) {
    return (
      <section className="py-16">
        <Container className="max-w-lg text-center text-sm text-neutral-500">Loading your order…</Container>
      </section>
    );
  }

  if (order === null) {
    return (
      <>
        <PageHeader heading="Order not found" />
        <section className="py-14">
          <Container className="max-w-lg text-center">
            <p className="text-sm text-neutral-600">{loadError ?? "We could not find this order on your account."}</p>
            <Link href="/" className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
              Back to home
            </Link>
          </Container>
        </section>
      </>
    );
  }

  const isPaid = order.paymentStatus === "paid";

  return (
    <>
      <PageHeader heading={isPaid ? "Order confirmed" : "Complete your payment"} subheading={`Order ${order.orderNumber}`} />
      <section className="py-10 sm:py-14">
        <Container className="max-w-2xl">
          {isPaid && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
              <Icon name="badge-check" className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
              <p className="text-sm text-green-800">
                Thanks — your payment was received and your booking is confirmed. Our team will confirm your visit by
                phone or WhatsApp.
              </p>
            </div>
          )}

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Services</h2>
          <ul className="mb-6 space-y-2">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-800">
                  {item.serviceName} × {item.quantity}
                </span>
                <span className="font-semibold text-neutral-900">{formatINR(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Address</h2>
          <p className="mb-6 text-sm text-neutral-800">
            {order.address.line1}
            {order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city}, {order.address.state} —{" "}
            {order.address.pincode}
          </p>

          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Schedule</h2>
          <p className="mb-6 text-sm text-neutral-800">
            {order.scheduledDate}
            {order.scheduledSlot ? ` — ${order.scheduledSlot}` : ""}
          </p>

          <div className="mb-6 flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2.5 text-sm font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatINR(order.total)}</span>
          </div>

          {!isPaid && (
            <div className="mb-6">
              <p className="mb-3 text-sm font-medium text-amber-700">
                {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus} — complete payment to confirm this
                booking.
              </p>
              <PaymentStep order={order} customerName={user.name} customerEmail={user.email} onPaid={load} />
            </div>
          )}

          <Link
            href="/"
            className="mt-2 inline-block rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:border-brand-500 hover:text-brand-700"
          >
            Back to home
          </Link>
        </Container>
      </section>
    </>
  );
}

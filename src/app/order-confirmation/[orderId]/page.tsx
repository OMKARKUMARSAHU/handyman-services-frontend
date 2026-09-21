"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getOrderById } from "@/lib/data/orders";
import { getServiceByIdSync } from "@/lib/data/services";
import { formatINR } from "@/lib/format";
import type { Order } from "@/types";
import { Icon } from "@/lib/icons";

export default function OrderConfirmationPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = typeof params?.orderId === "string" ? params.orderId : "";
  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getOrderById(orderId).then((result) => {
      if (!cancelled) setOrder(result);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

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
            <p className="text-sm text-neutral-600">
              We couldn&rsquo;t find this order in this browser. Orders in Phase 3 are a mock,
              browser-local record (no backend yet) — it may have been created in a different
              browser or cleared from storage.
            </p>
            <Link href="/" className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
              Back to home
            </Link>
          </Container>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader heading="Request received" subheading={`Order ${order.id}`} />
      <section className="py-10 sm:py-14">
        <Container className="max-w-2xl">
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <Icon name="badge-check" className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
            <p className="text-sm text-green-800">
              Thanks — your request has been received. This is a Phase 3 mock confirmation: no
              payment was taken and no technician has been dispatched automatically. Our team will
              confirm your visit by phone or WhatsApp.
            </p>
          </div>

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Services</h2>
          <ul className="mb-6 space-y-2">
            {order.items.map((item) => {
              const service = getServiceByIdSync(item.serviceId);
              return (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-800">
                    {service ? service.name : "Service"} × {item.quantity}
                  </span>
                  <span className="font-semibold text-neutral-900">{formatINR(item.lineTotal)}</span>
                </li>
              );
            })}
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

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2.5 text-sm font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatINR(order.total)}</span>
          </div>

          <Link
            href="/"
            className="mt-8 inline-block rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:border-brand-500 hover:text-brand-700"
          >
            Back to home
          </Link>
        </Container>
      </section>
    </>
  );
}

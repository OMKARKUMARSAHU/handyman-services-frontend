"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthApiError } from "@/lib/auth/api";
import { formatINR } from "@/lib/format";
import { cancelMyShopOrder, getMyShopOrder } from "@/lib/shop/api";
import type { ShopOrder } from "@/lib/shop/types";
import { useAuth } from "@/lib/state/AuthProvider";
import { OrderStatusBadge, PaymentStatusBadge } from "./ShopOrderStatusBadge";
import { ShopPaymentPanel } from "./ShopPaymentPanel";
import { displayName } from "./shopFormat";

export function ShopOrderDetailView({ orderId }: { orderId: string }) {
  const { user, status } = useAuth();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await getMyShopOrder(orderId));
      setError(null);
    } catch (err) {
      setError(err instanceof AuthApiError ? (err.status === 404 ? "We couldn't find this order." : err.message) : "Could not load this order.");
    }
  }, [orderId]);

  useEffect(() => {
    if (status !== "ready" || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void load();
  }, [status, user, load]);

  if (status === "loading") return <p className="py-10 text-center text-sm text-neutral-500">Loading…</p>;
  if (!user) {
    return (
      <div className="py-10 text-center text-sm text-neutral-600">
        Please{" "}
        <Link href={`/login?next=/shop/orders/${orderId}`} className="font-semibold text-brand-700 underline">
          log in
        </Link>{" "}
        to view this order.
      </div>
    );
  }
  if (error) return <p role="alert" className="rounded-lg bg-red-50 px-4 py-6 text-center text-sm text-red-700">{error}</p>;
  if (!order) return <p className="py-10 text-center text-sm text-neutral-500">Loading your order…</p>;

  const needsPayment = order.status === "pending_payment" && order.paymentStatus !== "paid";

  async function cancel() {
    if (!window.confirm("Cancel this unpaid order? Your reserved items will be released.")) return;
    setCancelling(true);
    try {
      setOrder(await cancelMyShopOrder(orderId));
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not cancel this order.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {(justPaid || (order.paymentStatus === "paid" && order.status === "paid")) && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Thank you! Your payment was verified and your order is confirmed.
        </p>
      )}
      {order.status === "cancelled" && order.paymentStatus === "paid" && (
        <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This order was cancelled after a payment was received. Our team will process your refund — please contact support if you don&rsquo;t hear from us.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Order {order.orderNumber}</h2>
          <p className="text-sm text-neutral-500">Placed {new Date(order.createdAt).toLocaleString("en-IN")}</p>
        </div>
        <div className="flex gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      {needsPayment && (
        <>
          <ShopPaymentPanel
            order={order}
            customerName={user.name}
            customerEmail={user.email}
            onPaid={() => {
              setJustPaid(true);
              void load();
            }}
          />
          <button type="button" onClick={cancel} disabled={cancelling} className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50">
            {cancelling ? "Cancelling…" : "Cancel this order"}
          </button>
        </>
      )}

      <section aria-labelledby="items-h">
        <h3 id="items-h" className="font-semibold text-neutral-900">Items</h3>
        <ul className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 p-4 text-sm">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                {i.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Media Library URL snapshot
                  <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-900">
                  {i.productSlug ? <Link href={`/products/${i.productSlug}`} className="hover:text-brand-700">{displayName(i.productName)}</Link> : displayName(i.productName)}
                </p>
                <p className="text-neutral-500">Qty {i.quantity} × {formatINR(i.unitPrice)}</p>
              </div>
              <p className="font-semibold">{formatINR(i.lineTotal)}</p>
            </li>
          ))}
        </ul>
      </section>

      <dl className="space-y-1 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <div className="flex justify-between"><dt className="text-neutral-600">Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-600">Delivery</dt><dd>{order.deliveryCharge > 0 ? formatINR(order.deliveryCharge) : "Free"}</dd></div>
        <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
      </dl>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
          <h3 className="font-semibold text-neutral-900">Delivery address</h3>
          <p className="mt-1 text-neutral-600">
            {order.shipping.name}<br />
            {order.shipping.line1}{order.shipping.line2 ? `, ${order.shipping.line2}` : ""}<br />
            {order.shipping.city}, {order.shipping.state} {order.shipping.pincode}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
          <h3 className="font-semibold text-neutral-900">Shipping</h3>
          {order.tracking.number || order.tracking.carrier ? (
            <p className="mt-1 text-neutral-600">
              {order.tracking.carrier ?? "Carrier"} {order.tracking.number ? `· Tracking ${order.tracking.number}` : ""}
              {order.tracking.shippedAt ? <><br />Shipped {new Date(order.tracking.shippedAt).toLocaleDateString("en-IN")}</> : null}
            </p>
          ) : (
            <p className="mt-1 text-neutral-500">Tracking details will appear here once your order ships.</p>
          )}
          {order.cancelReason && <p className="mt-2 text-neutral-500">Reason: {order.cancelReason}</p>}
        </div>
      </section>

      <Link href="/shop/orders" className="inline-block text-sm font-semibold text-brand-700 hover:underline">← All product orders</Link>
    </div>
  );
}

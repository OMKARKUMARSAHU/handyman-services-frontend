"use client";

import { useCallback, useEffect, useState } from "react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shop/ShopOrderStatusBadge";
import { displayName } from "@/components/shop/shopFormat";
import {
  AuthApiError,
  getAdminShopOrder,
  listAdminShopOrders,
  updateAdminShopOrderStatus,
  updateAdminShopOrderTracking,
} from "@/lib/admin/shop-api";
import { SHOP_ORDER_STATUS_LABEL, type PageMeta, type ShopAdminOrder, type ShopOrderStatus } from "@/lib/shop/types";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const errMsg = (e: unknown, fallback: string) => (e instanceof AuthApiError || e instanceof Error ? e.message : fallback);

/** Mirrors SHOP_ORDER_TRANSITIONS on the backend (which remains the authority). `pending_payment → paid` is never offered: only a verified payment can do it. */
const NEXT: Record<ShopOrderStatus, Array<"processing" | "shipped" | "delivered" | "cancelled" | "refunded">> = {
  pending_payment: ["cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

function isPaidAfterClosed(o: ShopAdminOrder): boolean {
  return o.paymentStatus === "paid" && (o.status === "cancelled" || o.status === "pending_payment");
}

export function AdminShopOrdersView({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<ShopAdminOrder[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listAdminShopOrders({ search: appliedSearch || undefined, status: status || undefined, paymentStatus: paymentStatus || undefined, page, pageSize: 20 });
      setItems(res.items);
      setMeta(res.meta);
    } catch (e) {
      setError(errMsg(e, "Could not load orders."));
      setItems([]);
    }
  }, [appliedSearch, status, paymentStatus, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (openId) {
    return (
      <OrderDetail
        orderId={openId}
        onBack={() => {
          setOpenId(null);
          void load();
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="flex min-w-[12rem] flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(search.trim());
          }}
        >
          <input className={inputClasses} placeholder="Order number, customer name / email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="submit" className="rounded-lg border border-neutral-300 px-4 text-sm hover:bg-neutral-50">Search</button>
        </form>
        <select className="rounded-lg border border-neutral-300 px-2 py-2 text-sm" aria-label="Order status" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Any order status</option>
          {Object.entries(SHOP_ORDER_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="rounded-lg border border-neutral-300 px-2 py-2 text-sm" aria-label="Payment status" value={paymentStatus} onChange={(e) => { setPage(1); setPaymentStatus(e.target.value); }}>
          <option value="">Any payment</option>
          <option value="unpaid">Unpaid</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {items === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">No shop orders match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((o) => (
                <tr key={o.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-neutral-900">{o.orderNumber}</p>
                    <p className="text-xs text-neutral-500">{new Date(o.createdAt).toLocaleString("en-IN")}</p>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{o.customer.name}<span className="block text-xs text-neutral-500">{o.customer.email ?? o.customer.phone ?? ""}</span></td>
                  <td className="px-3 py-2 text-right">{inr(o.total)}</td>
                  <td className="px-3 py-2"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-3 py-2">
                    <PaymentStatusBadge status={o.paymentStatus} />
                    {isPaidAfterClosed(o) && <span className="mt-1 block text-xs font-semibold text-amber-700">Paid after closed — refund needed</span>}
                  </td>
                  <td className="px-3 py-2 text-right"><button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => setOpenId(o.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span className="text-neutral-600">Page {meta.page} of {meta.totalPages} · {meta.total} orders</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

function OrderDetail({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [order, setOrder] = useState<ShopAdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [reason, setReason] = useState("");

  const apply = (o: ShopAdminOrder) => {
    setOrder(o);
    setCarrier(o.tracking.carrier ?? "");
    setTrackingNo(o.tracking.number ?? "");
  };

  useEffect(() => {
    getAdminShopOrder(orderId).then(apply).catch((e) => setError(errMsg(e, "Could not load the order.")));
  }, [orderId]);

  async function transition(next: "processing" | "shipped" | "delivered" | "cancelled" | "refunded") {
    if (!order) return;
    const warn =
      next === "cancelled"
        ? "Cancel this order? Reserved stock goes back on sale."
        : next === "refunded"
          ? "Mark this order as refunded? This only RECORDS a refund — it does not move any money. Refund the customer from your Razorpay dashboard."
          : null;
    if (warn && !window.confirm(warn)) return;
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      apply(
        await updateAdminShopOrderStatus(order.id, {
          status: next,
          ...(next === "shipped" ? { trackingCarrier: carrier.trim() || null, trackingNumber: trackingNo.trim() || null } : {}),
          reason: reason.trim() || null,
        })
      );
      setFlash(`Order marked ${SHOP_ORDER_STATUS_LABEL[next].toLowerCase()}.`);
      setReason("");
    } catch (e) {
      setError(errMsg(e, "Could not change the order status."));
    } finally {
      setBusy(false);
    }
  }

  async function saveTracking() {
    if (!order) return;
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      apply(await updateAdminShopOrderTracking(order.id, { trackingCarrier: carrier.trim() || null, trackingNumber: trackingNo.trim() || null }));
      setFlash("Tracking saved.");
    } catch (e) {
      setError(errMsg(e, "Could not save tracking."));
    } finally {
      setBusy(false);
    }
  }

  if (!order) return error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : <p className="text-sm text-neutral-500">Loading…</p>;

  const options = NEXT[order.status];

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-sm text-neutral-600 hover:text-neutral-900">← Back to orders</button>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-neutral-900">{order.orderNumber}</h3>
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} />
      </div>

      {isPaidAfterClosed(order) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          A verified payment arrived after this order was closed. Stock was not re-reserved. Refund the customer in Razorpay, then mark the order refunded.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {flash && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{flash}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase text-neutral-500">Customer</p>
          <p>{order.customer.name}</p>
          <p className="text-neutral-600">{order.customer.email}</p>
          <p className="text-neutral-600">{order.customer.phone}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase text-neutral-500">Ship to</p>
          <p>{order.shipping.name}{order.shipping.phone ? ` · ${order.shipping.phone}` : ""}</p>
          <p className="text-neutral-600">{order.shipping.line1}{order.shipping.line2 ? `, ${order.shipping.line2}` : ""}</p>
          <p className="text-neutral-600">{order.shipping.city}, {order.shipping.state} {order.shipping.pincode}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {order.items.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2">{displayName(i.productName)}<span className="block text-xs text-neutral-500">{i.productSku}</span></td>
                <td className="px-3 py-2 text-right">{inr(i.unitPrice)}</td>
                <td className="px-3 py-2 text-right">{i.quantity}</td>
                <td className="px-3 py-2 text-right">{inr(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr><td colSpan={3} className="px-3 py-1 text-right text-neutral-600">Subtotal</td><td className="px-3 py-1 text-right">{inr(order.subtotal)}</td></tr>
            <tr><td colSpan={3} className="px-3 py-1 text-right text-neutral-600">Delivery</td><td className="px-3 py-1 text-right">{inr(order.deliveryCharge)}</td></tr>
            <tr><td colSpan={3} className="px-3 py-1 text-right font-semibold">Total</td><td className="px-3 py-1 text-right font-semibold">{inr(order.total)}</td></tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-lg border border-neutral-200 p-3 text-sm">
        <p className="mb-1 text-xs font-semibold uppercase text-neutral-500">Payment</p>
        {order.payment ? (
          <ul className="space-y-0.5 text-neutral-700">
            <li>Provider: {order.payment.provider} · attempt status: {order.payment.status}</li>
            <li>Gateway order: {order.payment.providerOrderId ?? "—"}</li>
            <li>Gateway payment: {order.payment.providerPaymentId ?? "—"}</li>
            <li>Signature verified: {order.payment.signatureVerified ? "yes" : "no"}</li>
            {order.payment.failureReason && <li className="text-red-700">Failure: {order.payment.failureReason}</li>}
          </ul>
        ) : (
          <p className="text-neutral-500">No payment attempt yet.</p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-neutral-200 p-3">
        <p className="text-xs font-semibold uppercase text-neutral-500">Fulfilment</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={inputClasses} placeholder="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={120} />
          <input className={inputClasses} placeholder="Tracking number" value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} maxLength={120} />
        </div>
        <button type="button" disabled={busy} onClick={saveTracking} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50">Save tracking</button>

        {options.length > 0 ? (
          <>
            <input className={inputClasses} placeholder="Reason / note (optional, used for cancel & refund)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            <div className="flex flex-wrap gap-2">
              {options.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  onClick={() => transition(n)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${n === "cancelled" || n === "refunded" ? "border border-red-300 text-red-700 hover:bg-red-50" : "bg-brand-600 text-white hover:bg-brand-700"}`}
                >
                  Mark {SHOP_ORDER_STATUS_LABEL[n].toLowerCase()}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">This order is in a final state.</p>
        )}
        {order.status === "pending_payment" && (
          <p className="text-xs text-neutral-500">An order becomes “paid” only through a verified Razorpay payment — it cannot be marked paid manually.</p>
        )}
      </div>
    </div>
  );
}

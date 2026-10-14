"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthApiError } from "@/lib/auth/api";
import { formatINR } from "@/lib/format";
import { listMyShopOrders } from "@/lib/shop/api";
import type { PageMeta, ShopOrder } from "@/lib/shop/types";
import { useAuth } from "@/lib/state/AuthProvider";
import { OrderStatusBadge, PaymentStatusBadge } from "./ShopOrderStatusBadge";
import { displayName } from "./shopFormat";

export function ShopOrdersListView() {
  const { user, status } = useAuth();
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<ShopOrder[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ready" || !user || user.role !== "customer") return;
    let cancelled = false;
    listMyShopOrders(page)
      .then((r) => {
        if (cancelled) return;
        setOrders(r.data);
        setMeta(r.meta);
      })
      .catch((err) => !cancelled && setError(err instanceof AuthApiError ? err.message : "Could not load your orders."));
    return () => {
      cancelled = true;
    };
  }, [status, user, page]);

  if (status === "loading") return <p className="py-10 text-center text-sm text-neutral-500">Loading…</p>;
  if (!user) {
    return (
      <div className="py-10 text-center text-sm text-neutral-600">
        Please{" "}
        <Link href="/login?next=/shop/orders" className="font-semibold text-brand-700 underline">log in</Link> to see your product orders.
      </div>
    );
  }
  if (user.role !== "customer") return <p className="py-10 text-center text-sm text-neutral-600">Order history is available for customer accounts.</p>;
  if (error) return <p role="alert" className="rounded-lg bg-red-50 px-4 py-6 text-center text-sm text-red-700">{error}</p>;
  if (!orders) return <p className="py-10 text-center text-sm text-neutral-500">Loading your orders…</p>;
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center">
        <p className="font-semibold text-neutral-900">No product orders yet</p>
        <Link href="/products" className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Browse products</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl">
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/shop/orders/${o.id}`} className="block rounded-xl border border-neutral-200 bg-white p-4 hover:border-brand-400">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-neutral-900">{o.orderNumber}</p>
                <div className="flex gap-2"><OrderStatusBadge status={o.status} /><PaymentStatusBadge status={o.paymentStatus} /></div>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {new Date(o.createdAt).toLocaleDateString("en-IN")} · {o.items.reduce((n, i) => n + i.quantity, 0)} item(s) · <span className="font-semibold text-neutral-800">{formatINR(o.total)}</span>
              </p>
              <p className="mt-1 line-clamp-1 text-sm text-neutral-600">{o.items.map((i) => displayName(i.productName)).join(", ")}</p>
            </Link>
          </li>
        ))}
      </ul>
      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-40">Previous</button>
          <span>Page {meta.page} of {meta.totalPages}</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

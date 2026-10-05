"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/lib/state/AuthProvider";
import { AdminProviderQueue } from "@/components/account/AdminProviderQueue";
import { AdminCatalogPanel } from "@/components/account/AdminCatalogPanel";
import { AdminHomepageContentPanel } from "@/components/account/AdminHomepageContentPanel";
import {
  AuthApiError,
  listCustomers,
  setCustomerAccountStatus,
  listOrders,
  setOrderStatus,
  listProviders,
  getOrderStats,
  type AdminCustomerListItem,
  type AdminOrderListItem,
  type AdminOrderStatus,
  type AdminOrderStats,
} from "@/lib/admin/api";

type Tab = "overview" | "providers" | "customers" | "orders" | "catalog" | "homepage";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "layout-grid" },
  { key: "providers", label: "Provider Approvals", icon: "shield-check" },
  { key: "customers", label: "Customers", icon: "user" },
  { key: "orders", label: "Orders", icon: "package" },
  { key: "catalog", label: "Catalog", icon: "wrench" },
  { key: "homepage", label: "Homepage Content", icon: "layout-grid" },
];

const ORDER_STATUSES: AdminOrderStatus[] = ["pending", "confirmed", "assigned", "in_progress", "completed", "cancelled"];

const ORDER_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  assigned: "Technician assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * The Admin's single entry point at `/admin` (FINAL AUTHENTICATION
 * ARCHITECTURE §3/§7/§15; MASTER TASK Bug 4). Admin accounts are
 * operator-created only — there is no admin signup anywhere in the
 * frontend — and the `admin` Cognito group (verified server-side) is the
 * only authorization source for this page; every data call this component
 * makes is independently re-checked by `requireRole("admin")` on the
 * backend, so this component carries no authority of its own.
 *
 * Tabs: Overview (counts), Provider Approvals (the existing, already-working
 * `AdminProviderQueue`), Customers, Orders, and Catalog (Cities,
 * Categories, Products, Service Types, Services + approvals + city
 * availability + images, and Offers) — every one of these was already a
 * fully built, admin-gated backend module (see backend/src/modules/*);
 * this dashboard's job was only ever connecting the frontend to them, see
 * `AdminCatalogPanel` for the catalog management surface.
 */
export function AdminDashboardPanel() {
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  async function handleLogout() {
    await logout();
    router.push("/staff/login");
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
      <section className="py-14">
        <Container className="max-w-md text-center">
          <p className="text-sm text-neutral-600">Your session has expired.</p>
          <Button href="/staff/login" className="mt-4">
            Log in
          </Button>
        </Container>
      </section>
    );
  }

  if (user.role !== "admin") {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center">
          <p className="text-sm text-neutral-600">
            This account ({user.email ?? user.name}) does not have Admin access.
          </p>
          <Button href="/staff/login" className="mt-4">
            Sign in with a different account
          </Button>
        </Container>
      </section>
    );
  }

  return (
    <>
      <PageHeader heading="Admin Dashboard" subheading={`Signed in as Admin — ${user.name}${user.email ? ` (${user.email})` : ""}.`} />
      <section className="py-10 sm:py-14">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
            <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-colors lg:w-full ${
                    tab === t.key ? "bg-brand-50 text-brand-700" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  <Icon name={t.icon} className="h-4 w-4 shrink-0" />
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleLogout}
                className="flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 lg:mt-4 lg:w-full"
              >
                <Icon name="x" className="h-4 w-4 shrink-0" />
                Log out
              </button>
            </nav>

            <div className="min-w-0">
              {tab === "overview" && <AdminOverviewTab onNavigate={setTab} />}
              {tab === "providers" && <AdminProviderQueue />}
              {tab === "customers" && <AdminCustomersTab />}
              {tab === "orders" && <AdminOrdersTab />}
              {tab === "catalog" && <AdminCatalogPanel />}
              {tab === "homepage" && <AdminHomepageContentPanel />}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function AdminOverviewTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [pendingProviders, setPendingProviders] = useState<number | null>(null);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [stats, setStats] = useState<AdminOrderStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listProviders({ approvalStatus: "pending_approval" }), listCustomers(), getOrderStats()])
      .then(([providers, customers, orderStats]) => {
        setPendingProviders(providers.length);
        setCustomerCount(customers.length);
        setStats(orderStats);
      })
      .catch((err) => setError(err instanceof AuthApiError ? err.message : "Could not load the dashboard overview."));
  }, []);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate("providers")}
          className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition-colors hover:border-brand-300"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Pending provider approvals</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">{pendingProviders ?? "…"}</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("customers")}
          className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition-colors hover:border-brand-300"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Customers (latest page)</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">{customerCount ?? "…"}</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition-colors hover:border-brand-300"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total orders</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">{stats?.totalOrders ?? "…"}</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition-colors hover:border-brand-300"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Pending orders</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">{stats?.pendingOrders ?? "…"}</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("orders")}
          className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition-colors hover:border-brand-300"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Completed orders</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">{stats?.completedOrders ?? "…"}</p>
        </button>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Revenue (completed orders)</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">
            {stats ? `₹${stats.totalRevenue.toFixed(2)}` : "…"}
          </p>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        Customer count reflects the first page (up to 20 rows) — a full paginated view lives in the Customers tab.
        Order counts and revenue are real totals across every order, computed by the backend.
      </p>
    </div>
  );
}

function AdminCustomersTab() {
  const [customers, setCustomers] = useState<AdminCustomerListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async (searchTerm: string) => {
    setError(null);
    try {
      setCustomers(await listCustomers(searchTerm ? { search: searchTerm } : {}));
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not load customers.");
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  async function handleToggleStatus(c: AdminCustomerListItem) {
    setActioningId(c.id);
    try {
      const next = c.accountStatus === "active" ? "disabled" : "active";
      await setCustomerAccountStatus(c.id, next);
      await load(search);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not update this customer.");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Customers</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(search);
          }}
          className="flex gap-2"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <Button type="submit" size="md" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {customers === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}

      {customers !== null && customers.length === 0 && !error && (
        <p className="mt-4 text-sm text-neutral-500">No customers found.</p>
      )}

      {customers !== null && customers.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {customers.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{c.name}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.accountStatus === "active" ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {c.accountStatus === "active" ? "Active" : "Disabled"}
                </span>
                <Button
                  variant="outline"
                  size="md"
                  disabled={actioningId === c.id}
                  onClick={() => handleToggleStatus(c)}
                >
                  {c.accountStatus === "active" ? "Disable" : "Re-activate"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminOrdersTab() {
  const [orders, setOrders] = useState<AdminOrderListItem[] | null>(null);
  const [filter, setFilter] = useState<AdminOrderStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async (status: AdminOrderStatus | "all") => {
    setError(null);
    try {
      setOrders(await listOrders(status === "all" ? {} : { status }));
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not load orders.");
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function handleStatusChange(order: AdminOrderListItem, next: AdminOrderStatus) {
    setActioningId(order.id);
    try {
      await setOrderStatus(order.id, next);
      await load(filter);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not update this order.");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Orders</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as AdminOrderStatus | "all")}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {orders === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}

      {orders !== null && orders.length === 0 && !error && (
        <p className="mt-4 text-sm text-neutral-500">No orders in this category.</p>
      )}

      {orders !== null && orders.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">#{o.orderNumber}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {o.address.label}, {o.address.city} · ₹{o.total.toFixed(2)} · {o.paymentStatus}
                </p>
              </div>
              <select
                value={o.status}
                disabled={actioningId === o.id}
                onChange={(e) => handleStatusChange(o, e.target.value as AdminOrderStatus)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

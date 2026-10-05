"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/lib/state/AuthProvider";
import {
  AuthApiError,
  getMyProfile,
  updateMyProfile,
  listMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  listMyOrders,
  type CustomerProfile,
  type CustomerAddress,
  type AddressInput,
  type CustomerOrder,
} from "@/lib/customer/api";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";

type Tab = "overview" | "orders" | "addresses" | "profile" | "security";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "layout-grid" },
  { key: "orders", label: "My Orders", icon: "package" },
  { key: "addresses", label: "Saved Addresses", icon: "map-pin" },
  { key: "profile", label: "Profile", icon: "user" },
  { key: "security", label: "Account & Security", icon: "shield-check" },
];

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  assigned: "Technician assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{body}</p>
    </div>
  );
}

/**
 * The real Customer Dashboard at `/account` (MASTER TASK Bug 3 — replaces
 * the honest-but-bare "Profile" placeholder). Every section here is wired
 * to a backend endpoint that already existed and already worked
 * (`/customer/me`, `/customer/addresses`, `/customer/orders`) — this
 * component's whole job is connecting the frontend to work the backend
 * could already do, never inventing data: an order list that can't be
 * fetched yet shows a real empty state, not a fabricated order.
 */
export function CustomerDashboardPanel() {
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  async function handleLogout() {
    await logout();
    router.push("/login");
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
          <p className="text-sm text-neutral-600">You&rsquo;re not logged in yet.</p>
          <Button href="/login" className="mt-4">
            Log in or sign up
          </Button>
        </Container>
      </section>
    );
  }

  if (user.role !== "customer") {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center">
          <p className="text-sm text-neutral-600">
            This account ({user.email ?? user.name}) is a Staff account, not a Customer account.
          </p>
          <Button href="/staff/login" className="mt-4">
            Go to Staff Login
          </Button>
        </Container>
      </section>
    );
  }

  return (
    <>
      <PageHeader heading={`Welcome, ${user.name}`} subheading="Manage your orders, addresses and profile." />
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
              {tab === "overview" && <OverviewTab onNavigate={setTab} />}
              {tab === "orders" && <OrdersTab />}
              {tab === "addresses" && <AddressesTab />}
              {tab === "profile" && <ProfileTab />}
              {tab === "security" && <SecurityTab />}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function OverviewTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [addressCount, setAddressCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyProfile(), listMyOrders(), listMyAddresses()])
      .then(([p, o, a]) => {
        setProfile(p);
        setOrders(o);
        setAddressCount(a.length);
      })
      .catch((err) => setError(err instanceof AuthApiError ? err.message : "Could not load your account overview."));
  }, []);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Account status</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">
            {profile ? (profile.accountStatus === "active" ? "Active" : "Disabled") : "…"}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Orders</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">{orders ? orders.length : "…"}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Saved addresses</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">{addressCount ?? "…"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Most recent order</h2>
          <button type="button" onClick={() => onNavigate("orders")} className="text-sm font-medium text-brand-700 hover:underline">
            View all
          </button>
        </div>
        {orders === null ? (
          <p className="mt-4 text-sm text-neutral-500">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">You haven&rsquo;t placed any orders yet.</p>
        ) : (
          <OrderRow order={orders[0]} />
        )}
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: CustomerOrder }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
      <div>
        <p className="text-sm font-semibold text-neutral-900">#{order.orderNumber}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {order.scheduledDate} · {order.address.label}, {order.address.city}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700">
          {ORDER_STATUS_LABEL[order.status] ?? order.status}
        </span>
        <span className="text-sm font-semibold text-neutral-900">₹{order.total.toFixed(0)}</span>
      </div>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyOrders()
      .then(setOrders)
      .catch((err) => setError(err instanceof AuthApiError ? err.message : "Could not load your orders."));
  }, []);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">My Orders</h2>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      {orders === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {orders !== null && orders.length === 0 && (
        <div className="mt-4">
          <EmptyState icon="package" title="No orders yet" body="Your booking history will show up here once you place your first order." />
        </div>
      )}
      {orders !== null && orders.length > 0 && (
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddressesTab() {
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomerAddress | null>(null);

  const load = useCallback(() => {
    setError(null);
    listMyAddresses()
      .then(setAddresses)
      .catch((err) => setError(err instanceof AuthApiError ? err.message : "Could not load your addresses."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    try {
      await deleteMyAddress(id);
      load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not delete this address.");
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Saved Addresses</h2>
        <Button
          size="md"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
        >
          <Icon name="plus" className="h-4 w-4" />
          Add address
        </Button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      {showForm && (
        <div className="mt-4">
          <AddressForm
            initial={editing ?? undefined}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
              load();
            }}
          />
        </div>
      )}

      {addresses === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {addresses !== null && addresses.length === 0 && !showForm && (
        <div className="mt-4">
          <EmptyState icon="map-pin" title="No saved addresses yet" body="Add an address to make booking faster next time." />
        </div>
      )}
      {addresses !== null && addresses.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  {a.label}
                  {a.isDefault && (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Default</span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-neutral-600">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(a);
                    setShowForm(true);
                  }}
                  className="text-neutral-400 hover:text-neutral-700"
                  aria-label="Edit address"
                >
                  <Icon name="pencil" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  className="text-neutral-400 hover:text-red-600"
                  aria-label="Delete address"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddressForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: CustomerAddress;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AddressInput>({
    label: initial?.label ?? "",
    line1: initial?.line1 ?? "",
    line2: initial?.line2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    pincode: initial?.pincode ?? "",
    isDefault: initial?.isDefault ?? false,
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      if (initial) {
        await updateMyAddress(initial.id, form);
      } else {
        await createMyAddress(form);
      }
      onSaved();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof AuthApiError ? err.message : "Could not save this address.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Label (e.g. Home, Office) *</label>
          <input
            required
            className={inputClasses}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelClasses}>Pincode *</label>
          <input
            required
            className={inputClasses}
            value={form.pincode}
            onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className={labelClasses}>Address line 1 *</label>
        <input
          required
          className={inputClasses}
          value={form.line1}
          onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
        />
      </div>
      <div>
        <label className={labelClasses}>Address line 2</label>
        <input
          className={inputClasses}
          value={form.line2 ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>City *</label>
          <input
            required
            className={inputClasses}
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelClasses}>State *</label>
          <input
            required
            className={inputClasses}
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={form.isDefault ?? false}
          onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
        />
        Set as default address
      </label>

      {status === "error" && <p className="text-sm font-medium text-red-600">{errorMessage}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Saving…" : "Save address"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ProfileTab() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "submitting" | "error" | "saved">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setPhone(p.phone ?? "");
        setStatus("idle");
      })
      .catch((err) => {
        setErrorMessage(err instanceof AuthApiError ? err.message : "Could not load your profile.");
        setStatus("error");
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const updated = await updateMyProfile({ name, phone: phone || null });
      setProfile(updated);
      setStatus("saved");
    } catch (err) {
      setErrorMessage(err instanceof AuthApiError ? err.message : "Could not save your profile.");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">Profile details</h2>
      {status === "loading" && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {profile && (
        <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-4">
          <div>
            <label className={labelClasses}>Email</label>
            <input className={inputClasses} value={profile.email ?? ""} disabled />
            <p className="mt-1 text-xs text-neutral-500">Your email is managed by your account sign-in and can&rsquo;t be changed here.</p>
          </div>
          <div>
            <label className={labelClasses}>Full name *</label>
            <input required className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClasses}>Mobile number</label>
            <input className={inputClasses} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {status === "error" && <p className="text-sm font-medium text-red-600">{errorMessage}</p>}
          {status === "saved" && <p className="text-sm font-medium text-green-700">Saved.</p>}

          <Button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Saving…" : "Save changes"}
          </Button>
        </form>
      )}
    </div>
  );
}

function SecurityTab() {
  const { user } = useAuth();
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">Account &amp; Security</h2>
      <p className="mt-3 text-sm text-neutral-600">
        Signed in as {user?.email ?? user?.name}. Your password is managed securely through your account&rsquo;s sign-in
        provider — nothing about it is ever stored or visible here.
      </p>
      <Button href="/forgot-password" variant="outline" className="mt-5">
        Change password
      </Button>
    </div>
  );
}

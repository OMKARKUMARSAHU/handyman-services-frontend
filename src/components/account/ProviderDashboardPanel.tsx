"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/lib/state/AuthProvider";
import {
  AuthApiError,
  listMyListings,
  createMyListing,
  updateMyListing,
  type ProviderListingItem,
  type ProviderListingInput,
} from "@/lib/provider/api";
import {
  listCategoriesAdmin as listCategories,
  listProductsByCategorySlug,
  listServiceTypesAdmin as listServiceTypes,
  type AdminCategory,
  type AdminProduct,
  type AdminServiceType,
} from "@/lib/admin/catalog-api";

type Tab = "overview" | "profile" | "services" | "jobs" | "security";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "layout-grid" },
  { key: "profile", label: "Provider Profile", icon: "user" },
  { key: "services", label: "My Services", icon: "package" },
  { key: "jobs", label: "Jobs & Earnings", icon: "wrench" },
  { key: "security", label: "Account & Security", icon: "shield-check" },
];

function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
        <Icon name="wrench" className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{body}</p>
    </div>
  );
}

/**
 * The Service Provider's single entry point at `/provider` (FINAL
 * AUTHENTICATION ARCHITECTURE §4/§10/§15; MASTER TASK Bug 5). Authorization
 * here considers BOTH signals from the verified session: the Cognito
 * `provider` group (already enforced by the backend's `requireRole`
 * before any data here can load) AND the local `approvalStatus` carried on
 * `GET /me` — being in the group is never by itself enough to reach the
 * dashboard. Pending/rejected providers get their own honest status
 * screens below, never the dashboard.
 *
 * The approved dashboard's "Provider Profile" tab uses the profile fields
 * already present on the verified `/me` response (businessName, city,
 * categories, etc.) — no second fetch is needed just to show them. "My
 * Services" is wired to the existing, already-working `/provider/listings`
 * endpoint. "Jobs & Earnings" is a deliberate "coming soon" — no
 * provider-facing job/earnings endpoint exists in the backend yet, and
 * MASTER TASK explicitly forbids inventing financial/order data.
 */
export function ProviderDashboardPanel() {
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

  if (user.role !== "provider") {
    return (
      <section className="py-14">
        <Container className="max-w-md text-center">
          <p className="text-sm text-neutral-600">
            This account ({user.email ?? user.name}) does not have Service Provider access.
          </p>
          <Button href="/staff/login" className="mt-4">
            Sign in with a different account
          </Button>
        </Container>
      </section>
    );
  }

  if (user.approvalStatus === "pending_approval") {
    return (
      <>
        <PageHeader heading="Service Provider Portal" subheading={`Signed in as ${user.name}${user.email ? ` (${user.email})` : ""}.`} />
        <section className="py-14">
          <Container className="max-w-md">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Icon name="clock" className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-semibold text-neutral-900">Your Service Provider account is awaiting approval.</p>
              <p className="mt-2 text-sm text-neutral-600">
                Your application has been submitted successfully. An administrator must approve your account before you can
                access the Service Provider dashboard.
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-amber-700">Status: Pending approval</p>
              <Button variant="outline" className="mt-6" onClick={handleLogout}>
                Log out
              </Button>
            </div>
            <p className="mt-4 text-center text-sm text-neutral-500">
              <a href="/staff/login" className="font-medium text-brand-700 hover:underline">
                Back to login
              </a>
            </p>
          </Container>
        </section>
      </>
    );
  }

  if (user.approvalStatus === "rejected") {
    return (
      <>
        <PageHeader heading="Service Provider Portal" subheading={`Signed in as ${user.name}${user.email ? ` (${user.email})` : ""}.`} />
        <section className="py-14">
          <Container className="max-w-md">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Icon name="x-circle" className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-semibold text-neutral-900">Your Service Provider application was not approved.</p>
              {user.rejectionReason ? (
                <p className="mt-2 text-sm text-neutral-600">Reason: {user.rejectionReason}</p>
              ) : (
                <p className="mt-2 text-sm text-neutral-600">
                  Contact support if you believe this is a mistake, or if your circumstances have changed.
                </p>
              )}
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-red-700">Status: Rejected</p>
              <Button variant="outline" className="mt-6" onClick={handleLogout}>
                Log out
              </Button>
            </div>
            <p className="mt-4 text-center text-sm text-neutral-500">
              <a href="/staff/login" className="font-medium text-brand-700 hover:underline">
                Back to login
              </a>
            </p>
          </Container>
        </section>
      </>
    );
  }

  // approvalStatus === "approved"
  return (
    <>
      <PageHeader heading="Service Provider Dashboard" subheading={`Signed in as ${user.name}${user.email ? ` (${user.email})` : ""}.`} />
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
              {tab === "overview" && <ProviderOverviewTab onNavigate={setTab} />}
              {tab === "profile" && <ProviderProfileTab />}
              {tab === "services" && <ProviderServicesTab />}
              {tab === "jobs" && (
                <ComingSoon
                  title="Jobs, assignments and earnings are coming soon"
                  body="There's no provider-facing job/earnings endpoint yet — this phase delivered the approved, approval-gated dashboard above; job assignment and earnings reporting are a later phase."
                />
              )}
              {tab === "security" && <ProviderSecurityTab />}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function ProviderOverviewTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const { user } = useAuth();
  const [listings, setListings] = useState<ProviderListingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyListings()
      .then(setListings)
      .catch((err) => setError(err instanceof AuthApiError ? err.message : "Could not load your services."));
  }, []);

  const activeCount = listings?.filter((l) => l.active && l.approvalStatus === "approved").length ?? null;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">Approval status</p>
          <p className="mt-1.5 text-lg font-semibold text-green-800">Approved</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("services")}
          className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition-colors hover:border-brand-300"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Live services</p>
          <p className="mt-1.5 text-lg font-semibold text-neutral-900">{activeCount ?? (listings === null ? "…" : listings.length)}</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition-colors hover:border-brand-300"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Business name</p>
          <p className="mt-1.5 truncate text-lg font-semibold text-neutral-900">{user?.businessName ?? user?.name}</p>
        </button>
      </div>
    </div>
  );
}

function ProviderProfileTab() {
  const { user } = useAuth();
  if (!user) return null;

  const rows: { label: string; value: string }[] = [
    { label: "Name", value: user.name },
    { label: "Email", value: user.email ?? "—" },
    { label: "Business name", value: user.businessName ?? "—" },
    { label: "City", value: user.city ?? "—" },
    { label: "Categories", value: user.categories && user.categories.length > 0 ? user.categories.join(", ") : "—" },
    { label: "Years of experience", value: user.yearsExperience != null ? String(user.yearsExperience) : "—" },
    { label: "Availability", value: user.availability ?? "—" },
    { label: "Bio", value: user.bio ?? "—" },
  ];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">Provider profile</h2>
      <dl className="mt-4 divide-y divide-neutral-100">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
            <dt className="text-sm text-neutral-500">{r.label}</dt>
            <dd className="text-sm font-medium text-neutral-900">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-neutral-500">
        Editing your provider profile from this dashboard is a natural next step — not built in this phase, to avoid guessing
        at a profile-edit workflow the backend doesn&rsquo;t define yet.
      </p>
    </div>
  );
}

const providerInputClasses =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const providerLabelClasses = "mb-1 block text-xs font-medium text-neutral-700";

/**
 * PROVIDER PANEL AUDIT FOLLOW-UP: this used to be read-only even though
 * `POST /provider/listings` and `PATCH /provider/listings/:id` already
 * existed and already worked server-side (ownership- and
 * approval-gated). A provider could see their listings but never
 * actually create or edit one from the dashboard. Now wired to both —
 * a new listing goes through the same shared admin/provider approval
 * queue as before (`approvalStatus` starts `pending_approval`), and an
 * edit (price, active state) persists through the real backend, never
 * localStorage.
 */
function ProviderServicesTab() {
  const [listings, setListings] = useState<ProviderListingItem[] | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [serviceTypes, setServiceTypes] = useState<AdminServiceType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setListings(await listMyListings());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not load your services.");
      setListings([]);
    }
  }, []);

  useEffect(() => {
    load();
    Promise.all([listCategories(), listServiceTypes()])
      .then(([cats, types]) => {
        setCategories(cats);
        setServiceTypes(types);
      })
      .catch(() => {
        /* reference data failing to load only disables "Add Service"; the listing view above still works */
      });
  }, [load]);

  async function handleCreate(input: ProviderListingInput) {
    setSaving(true);
    setError(null);
    try {
      await createMyListing(input);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not create this listing.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(l: ProviderListingItem) {
    setSaving(true);
    setError(null);
    try {
      await updateMyListing(l.id, { active: !l.active });
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not update this listing.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePrice(l: ProviderListingItem) {
    const offerPrice = Number(editPrice);
    if (!Number.isFinite(offerPrice) || offerPrice < 0) {
      setError("Enter a valid offer price.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMyListing(l.id, { offerPrice });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not update this listing's price.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">My services</h2>
        <Button
          size="md"
          variant="outline"
          disabled={categories.length === 0 || serviceTypes.length === 0}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "Add Service"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {showForm && (
        <ProviderListingForm
          categories={categories}
          serviceTypes={serviceTypes}
          saving={saving}
          onCancel={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
      )}

      {listings === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}

      {listings !== null && listings.length === 0 && !error && (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
          <p className="text-sm text-neutral-600">You haven&rsquo;t listed any services yet.</p>
        </div>
      )}

      {listings !== null && listings.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{l.name}</p>
                {editingId === l.id ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      className={providerInputClasses + " w-28"}
                      type="number"
                      min={0}
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                    />
                    <Button size="md" disabled={saving} onClick={() => handleSavePrice(l)}>
                      Save
                    </Button>
                    <Button size="md" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <p className="mt-0.5 text-xs text-neutral-500">
                    ₹{l.offerPrice.toFixed(2)}{" "}
                    <span className="text-neutral-400 line-through">₹{l.mrp.toFixed(2)}</span> · {l.active ? "Active" : "Inactive"}
                  </p>
                )}
                {l.approvalStatus === "rejected" && l.rejectionReason && (
                  <p className="mt-1 text-xs text-red-600">Rejection reason: {l.rejectionReason}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    l.approvalStatus === "approved"
                      ? "bg-green-100 text-green-700"
                      : l.approvalStatus === "rejected"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {l.approvalStatus === "pending_approval" ? "Pending" : l.approvalStatus === "approved" ? "Approved" : "Rejected"}
                </span>
                <Button
                  size="md"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setEditingId(l.id);
                    setEditPrice(l.offerPrice.toString());
                  }}
                >
                  Edit price
                </Button>
                <Button size="md" variant="outline" disabled={saving} onClick={() => handleToggleActive(l)}>
                  {l.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProviderListingForm({
  categories,
  serviceTypes,
  saving,
  onCancel,
  onSubmit,
}: {
  categories: AdminCategory[];
  serviceTypes: AdminServiceType[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: ProviderListingInput) => void;
}) {
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState(serviceTypes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [mrp, setMrp] = useState("");
  const [offerPrice, setOfferPrice] = useState("");

  useEffect(() => {
    if (!categorySlug) return;
    listProductsByCategorySlug(categorySlug)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [categorySlug]);

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ slug, productId, serviceTypeId, name, shortDescription, description, mrp: Number(mrp), offerPrice: Number(offerPrice) });
      }}
    >
      <p className="text-xs text-neutral-500 sm:col-span-2">
        New listings go into the same Admin approval queue as any other service — they won&rsquo;t appear on the
        storefront until an Admin approves them.
      </p>
      <div>
        <label className={providerLabelClasses}>Category</label>
        <select className={providerInputClasses} value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={providerLabelClasses}>Product / Appliance</label>
        <select className={providerInputClasses} value={productId} onChange={(e) => setProductId(e.target.value)} required>
          <option value="" disabled>
            Select a product…
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={providerLabelClasses}>Service type</label>
        <select className={providerInputClasses} value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} required>
          {serviceTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={providerLabelClasses}>Service name</label>
        <input className={providerInputClasses} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={providerLabelClasses}>Slug</label>
        <input className={providerInputClasses} value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" />
      </div>
      <div>
        <label className={providerLabelClasses}>MRP (₹)</label>
        <input className={providerInputClasses} type="number" min={0} step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} required />
      </div>
      <div className="sm:col-span-2">
        <label className={providerLabelClasses}>Offer price (₹)</label>
        <input
          className={providerInputClasses}
          type="number"
          min={0}
          step="0.01"
          value={offerPrice}
          onChange={(e) => setOfferPrice(e.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className={providerLabelClasses}>Short description</label>
        <input className={providerInputClasses} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} required maxLength={500} />
      </div>
      <div className="sm:col-span-2">
        <label className={providerLabelClasses}>Full description</label>
        <textarea className={providerInputClasses} value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="md" disabled={saving}>
          Submit for approval
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ProviderSecurityTab() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">Account &amp; security</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Your sign-in uses a secure, HttpOnly session cookie — your password is never stored in the browser.
      </p>
      <Button href="/staff/forgot-password" variant="outline" className="mt-4">
        Change password
      </Button>
    </div>
  );
}

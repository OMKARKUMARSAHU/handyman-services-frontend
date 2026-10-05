"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import { MediaPicker, MediaPickerField } from "@/components/account/MediaPicker";
import {
  AuthApiError,
  listCitiesAdmin,
  createCity,
  updateCity,
  type AdminCity,
  type CityInput,
  listCategoriesAdmin,
  createCategory,
  updateCategory,
  type AdminCategory,
  type CategoryInput,
  listProductsByCategorySlug,
  createProduct,
  updateProduct,
  type AdminProduct,
  type ProductInput,
  listServiceTypesAdmin,
  createServiceType,
  updateServiceType,
  type AdminServiceType,
  type ServiceTypeInput,
  listServicesAdmin,
  createService,
  updateService,
  setServiceCityAvailability,
  approveListing,
  rejectListing,
  type AdminService,
  type ServiceInput,
  type ApprovalStatus,
  listOffersAdmin,
  createOffer,
  updateOffer,
  type AdminOffer,
  type OfferInput,
  attachServiceImage,
  updateServiceImage,
  type AdminServiceImage,
  deleteServiceImage,
} from "@/lib/admin/catalog-api";

/**
 * Admin Catalog Management — replaces the old "Catalog management is
 * coming soon" placeholder. Every entity below (cities, categories,
 * products, service types, services, offers, images) already had a full,
 * admin-gated CRUD API on the backend (see each module under
 * backend/src/modules/*) — nothing here was invented; this file is purely
 * the frontend connection that never existed. City/category/product/
 * service-type/service/offer writes all persist to the real database
 * through the real backend, exactly like every other Admin tab.
 */

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1 block text-xs font-medium text-neutral-700";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof AuthApiError ? err.message : fallback;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-6">{children}</div>;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"
      }`}
    >
      {active ? "Active" : "Disabled"}
    </span>
  );
}

// MEDIA LIBRARY FOLLOW-UP: the old per-file ImageUploadField (CMS presign
// upload only, no reuse) is gone. Every single-image/video admin field in
// this file now uses MediaPickerField (@/components/account/MediaPicker),
// the shared Central Media Picker -- "Select from Media Library" / "Upload
// New Media", backed by the same /admin/media-library API everywhere.

type CatalogTab = "cities" | "categories" | "products" | "serviceTypes" | "services" | "offers";

const CATALOG_TABS: { key: CatalogTab; label: string; icon: string }[] = [
  { key: "cities", label: "Cities", icon: "map-pin" },
  { key: "categories", label: "Categories", icon: "layout-grid" },
  { key: "products", label: "Products", icon: "package" },
  { key: "serviceTypes", label: "Service Types", icon: "wrench" },
  { key: "services", label: "Services", icon: "shield-check" },
  { key: "offers", label: "Offers", icon: "star" },
];

export function AdminCatalogPanel() {
  const [tab, setTab] = useState<CatalogTab>("cities");

  return (
    <div className="space-y-5">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Catalog sections">
        {CATALOG_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5 shrink-0" />
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "cities" && <CitiesManager />}
      {tab === "categories" && <CategoriesManager />}
      {tab === "products" && <ProductsManager />}
      {tab === "serviceTypes" && <ServiceTypesManager />}
      {tab === "services" && <ServicesManager />}
      {tab === "offers" && <OffersManager />}
    </div>
  );
}

// ---------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------

function CitiesManager() {
  const [cities, setCities] = useState<AdminCity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminCity | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCities(await listCitiesAdmin());
    } catch (err) {
      setError(errorMessage(err, "Could not load cities."));
      setCities([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(input: CityInput) {
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateCity(editing.id, input);
      else await createCity(input);
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not save this city."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Cities</h2>
        <Button
          size="md"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm && !editing ? "Cancel" : "Add City"}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      {showForm && (
        <CityForm
          key={editing?.id ?? "new"}
          initial={editing}
          saving={saving}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {cities === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {cities !== null && cities.length === 0 && <p className="mt-4 text-sm text-neutral-500">No cities yet.</p>}

      {cities !== null && cities.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {cities
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {c.name}, {c.state} {c.isPopular && <span className="ml-1 text-xs text-brand-600">(popular)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">/{c.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill active={c.active} />
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setEditing(c);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    disabled={saving}
                    onClick={() => handleSubmit({ ...c, active: !c.active })}
                  >
                    {c.active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

function CityForm({
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  initial: AdminCity | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: CityInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [isPopular, setIsPopular] = useState(initial?.isPopular ?? false);
  const [iconUrl, setIconUrl] = useState<string | null>(initial?.iconUrl ?? null);

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, state, slug, isPopular, active: initial?.active ?? true, iconUrl });
      }}
    >
      <div>
        <label className={labelClasses}>City name</label>
        <input className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClasses}>State</label>
        <input className={inputClasses} value={state} onChange={(e) => setState(e.target.value)} required />
      </div>
      <div>
        <label className={labelClasses}>Slug (lowercase, hyphenated)</label>
        <input className={inputClasses} value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" />
      </div>
      <div className="flex items-center gap-2 pt-6">
        <input id="city-popular" type="checkbox" checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} />
        <label htmlFor="city-popular" className="text-sm text-neutral-700">
          Popular city
        </label>
      </div>
      <MediaPickerField label="City icon/photo (optional)" accept="image" value={iconUrl} onChange={setIconUrl} />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="md" disabled={saving}>
          {initial ? "Save changes" : "Create city"}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------

function CategoriesManager() {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCategories(await listCategoriesAdmin());
    } catch (err) {
      setError(errorMessage(err, "Could not load categories."));
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(input: CategoryInput) {
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateCategory(editing.id, input);
      else await createCategory(input);
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not save this category."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Categories</h2>
        <Button
          size="md"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm && !editing ? "Cancel" : "Add Category"}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      {showForm && (
        <CategoryForm
          key={editing?.id ?? "new"}
          initial={editing}
          saving={saving}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {categories === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {categories !== null && categories.length === 0 && <p className="mt-4 text-sm text-neutral-500">No categories yet.</p>}

      {categories !== null && categories.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {categories
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{c.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">/{c.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill active={c.active} />
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setEditing(c);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="outline" size="md" disabled={saving} onClick={() => handleSubmit({ ...c, active: !c.active })}>
                    {c.active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

function CategoryForm({
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  initial: AdminCategory | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: CategoryInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "wrench");
  const [image, setImage] = useState<string | null>(initial?.image ?? null);

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, slug, description, icon, active: initial?.active ?? true, image });
      }}
    >
      <div>
        <label className={labelClasses}>Category name</label>
        <input className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClasses}>Slug</label>
        <input className={inputClasses} value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClasses}>Description</label>
        <textarea
          className={inputClasses}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={2}
        />
      </div>
      <div>
        <label className={labelClasses}>Icon key (from the existing icon set, e.g. "snowflake", "washing-machine")</label>
        <input className={inputClasses} value={icon} onChange={(e) => setIcon(e.target.value)} required />
      </div>
      <MediaPickerField label="Category photo (optional — falls back to the icon above)" accept="image" value={image} onChange={setImage} />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="md" disabled={saving}>
          {initial ? "Save changes" : "Create category"}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Products (scoped to one category at a time)
// ---------------------------------------------------------------------

function ProductsManager() {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCategoriesAdmin()
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setCategorySlug(cats[0]!.slug);
      })
      .catch((err) => setError(errorMessage(err, "Could not load categories.")));
  }, []);

  const load = useCallback(async (slug: string) => {
    if (!slug) return;
    setError(null);
    try {
      setProducts(await listProductsByCategorySlug(slug));
    } catch (err) {
      setError(errorMessage(err, "Could not load products."));
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    load(categorySlug);
  }, [categorySlug, load]);

  const activeCategory = categories?.find((c) => c.slug === categorySlug) ?? null;

  async function handleSubmit(input: ProductInput) {
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateProduct(editing.id, input);
      else await createProduct(input);
      setShowForm(false);
      setEditing(null);
      await load(categorySlug);
    } catch (err) {
      setError(errorMessage(err, "Could not save this product."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Products</h2>
        <div className="flex items-center gap-2">
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className={inputClasses + " w-auto"}
          >
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            size="md"
            variant="outline"
            disabled={!activeCategory}
            onClick={() => {
              setEditing(null);
              setShowForm((v) => !v);
            }}
          >
            {showForm && !editing ? "Cancel" : "Add Product"}
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      {showForm && activeCategory && (
        <ProductForm
          key={editing?.id ?? "new"}
          categoryId={activeCategory.id}
          initial={editing}
          saving={saving}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {products === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {products !== null && products.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">No products in this category yet.</p>
      )}

      {products !== null && products.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {products
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{p.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">/{p.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill active={p.active} />
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setEditing(p);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    disabled={saving}
                    onClick={() => handleSubmit({ ...p, categoryId: p.categoryId, active: !p.active })}
                  >
                    {p.active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

function ProductForm({
  categoryId,
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  categoryId: string;
  initial: AdminProduct | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: ProductInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "wrench");
  const [image, setImage] = useState<string | null>(initial?.image ?? null);

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ categoryId, name, slug, description, icon, active: initial?.active ?? true, image });
      }}
    >
      <div>
        <label className={labelClasses}>Product/appliance name</label>
        <input className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClasses}>Slug</label>
        <input className={inputClasses} value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClasses}>Description</label>
        <textarea className={inputClasses} value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
      </div>
      <div>
        <label className={labelClasses}>Icon key</label>
        <input className={inputClasses} value={icon} onChange={(e) => setIcon(e.target.value)} required />
      </div>
      <MediaPickerField label="Product photo (optional — falls back to the icon above)" accept="image" value={image} onChange={setImage} />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="md" disabled={saving}>
          {initial ? "Save changes" : "Create product"}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Service Types
// ---------------------------------------------------------------------

function ServiceTypesManager() {
  const [types, setTypes] = useState<AdminServiceType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminServiceType | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTypes(await listServiceTypesAdmin());
    } catch (err) {
      setError(errorMessage(err, "Could not load service types."));
      setTypes([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(input: ServiceTypeInput) {
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateServiceType(editing.id, input);
      else await createServiceType(input);
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not save this service type."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Service Types</h2>
        <p className="text-xs text-neutral-500">Installation · Service · Repair · AMC, etc.</p>
        <Button
          size="md"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm && !editing ? "Cancel" : "Add Type"}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      {showForm && (
        <form
          className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const key = (form.elements.namedItem("key") as HTMLInputElement).value;
            const label = (form.elements.namedItem("label") as HTMLInputElement).value;
            handleSubmit({ key, label, active: editing?.active ?? true });
          }}
        >
          <div>
            <label className={labelClasses}>Key (lowercase_with_underscores)</label>
            <input name="key" className={inputClasses} defaultValue={editing?.key ?? ""} required pattern="[a-z0-9_]+" />
          </div>
          <div>
            <label className={labelClasses}>Label</label>
            <input name="label" className={inputClasses} defaultValue={editing?.label ?? ""} required />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="md" disabled={saving}>
              {editing ? "Save changes" : "Create type"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {types === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {types !== null && types.length === 0 && <p className="mt-4 text-sm text-neutral-500">No service types yet.</p>}

      {types !== null && types.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {types.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{t.label}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{t.key}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill active={t.active} />
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setEditing(t);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="outline" size="md" disabled={saving} onClick={() => handleSubmit({ ...t, active: !t.active })}>
                  {t.active ? "Disable" : "Enable"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Services (listings, pricing, city availability, images, approvals)
// ---------------------------------------------------------------------

const SERVICE_STATUS_TABS: { key: ApprovalStatus; label: string }[] = [
  { key: "pending_approval", label: "Pending Approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

/**
 * ADMIN CMS FOLLOW-UP ("services not properly visible in Admin"): this
 * defaulted to the "Pending Approval" queue, which is empty for an
 * already-seeded/approved catalog (every seeded service has
 * approval_status "approved") -- so Admin looked empty on first load even
 * though the services existed. "Approved" is the useful default for
 * managing an existing catalog; "Pending Approval" is still one click
 * away for reviewing new submissions.
 */
function ServicesManager() {
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus>("approved");
  const [services, setServices] = useState<AdminService[] | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [serviceTypes, setServiceTypes] = useState<AdminServiceType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCategoriesAdmin(), listCitiesAdmin(), listServiceTypesAdmin()])
      .then(([cats, cityList, types]) => {
        setCategories(cats);
        setCities(cityList);
        setServiceTypes(types);
      })
      .catch((err) => setError(errorMessage(err, "Could not load catalog reference data.")));
  }, []);

  const load = useCallback(async (status: ApprovalStatus) => {
    setError(null);
    try {
      setServices(await listServicesAdmin({ status }));
    } catch (err) {
      setError(errorMessage(err, "Could not load services."));
      setServices([]);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter, load]);

  async function refresh() {
    await load(statusFilter);
  }

  async function handleSubmit(input: ServiceInput) {
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateService(editing.id, input);
      else await createService(input);
      setShowForm(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not save this service."));
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    setSaving(true);
    setError(null);
    try {
      await approveListing(id);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not approve this listing."));
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt("Reason for rejecting this listing?");
    if (!reason) return;
    setSaving(true);
    setError(null);
    try {
      await rejectListing(id, reason);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not reject this listing."));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(s: AdminService) {
    setSaving(true);
    setError(null);
    try {
      await updateService(s.id, { active: !s.active });
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not update this service."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Services</h2>
        <Button
          size="md"
          variant="outline"
          disabled={categories.length === 0 || serviceTypes.length === 0}
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm && !editing ? "Cancel" : "Add Service"}
        </Button>
      </div>

      <div className="mt-3 flex gap-2">
        {SERVICE_STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusFilter(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === t.key ? "bg-brand-100 text-brand-700" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      {showForm && (
        <ServiceForm
          key={editing?.id ?? "new"}
          categories={categories}
          serviceTypes={serviceTypes}
          initial={editing}
          saving={saving}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {services === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {services !== null && services.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">
          No services with status &ldquo;{SERVICE_STATUS_TABS.find((t) => t.key === statusFilter)?.label}&rdquo;.
        </p>
      )}

      {services !== null && services.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {services.map((s) => (
            <li key={s.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{s.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    /{s.slug} · MRP ₹{s.mrp.toFixed(2)} · Offer ₹{s.offerPrice.toFixed(2)} · Final ₹{s.finalPrice.toFixed(2)}
                    {s.effectiveOffer && ` (offer: ${s.effectiveOffer.title})`}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">Created by {s.createdByRole}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill active={s.active} />
                  {s.approvalStatus === "pending_approval" && (
                    <>
                      <Button size="md" variant="outline" disabled={saving} onClick={() => handleApprove(s.id)}>
                        Approve
                      </Button>
                      <Button size="md" variant="outline" disabled={saving} onClick={() => handleReject(s.id)}>
                        Reject
                      </Button>
                    </>
                  )}
                  {s.approvalStatus === "rejected" && s.rejectionReason && (
                    <span className="text-xs text-red-600">Reason: {s.rejectionReason}</span>
                  )}
                  <Button
                    size="md"
                    variant="outline"
                    onClick={() => {
                      setEditing(s);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="md" variant="outline" disabled={saving} onClick={() => handleToggleActive(s)}>
                    {s.active ? "Disable" : "Enable"}
                  </Button>
                  <Button size="md" variant="outline" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                    {expandedId === s.id ? "Hide details" : "Cities & Images"}
                  </Button>
                </div>
              </div>

              {expandedId === s.id && (
                <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
                  <CityAvailabilityEditor service={s} cities={cities} onUpdated={refresh} />
                  <ServiceImagesEditor service={s} onUpdated={refresh} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ServiceForm({
  categories,
  serviceTypes,
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  categories: AdminCategory[];
  serviceTypes: AdminServiceType[];
  initial: AdminService | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: ServiceInput) => void;
}) {
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productId, setProductId] = useState(initial?.productId ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(initial?.serviceTypeId ?? serviceTypes[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [mrp, setMrp] = useState(initial?.mrp?.toString() ?? "");
  const [offerPrice, setOfferPrice] = useState(initial?.offerPrice?.toString() ?? "");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [isMostBooked, setIsMostBooked] = useState(initial?.isMostBooked ?? false);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder?.toString() ?? "0");

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
        onSubmit({
          slug,
          productId,
          serviceTypeId,
          name,
          shortDescription,
          description,
          mrp: Number(mrp),
          offerPrice: Number(offerPrice),
          featured,
          isMostBooked,
          sortOrder: Number(sortOrder) || 0,
        });
      }}
    >
      {!initial && (
        <div>
          <label className={labelClasses}>Category</label>
          <select className={inputClasses} value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!initial && (
        <div>
          <label className={labelClasses}>Product / Appliance</label>
          <select className={inputClasses} value={productId} onChange={(e) => setProductId(e.target.value)} required>
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
      )}
      <div>
        <label className={labelClasses}>Service type</label>
        <select className={inputClasses} value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} required>
          {serviceTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClasses}>Service name</label>
        <input className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClasses}>Slug</label>
        <input className={inputClasses} value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" />
      </div>
      <div>
        <label className={labelClasses}>MRP (₹)</label>
        <input className={inputClasses} type="number" min={0} step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} required />
      </div>
      <div>
        <label className={labelClasses}>Offer price (₹)</label>
        <input
          className={inputClasses}
          type="number"
          min={0}
          step="0.01"
          value={offerPrice}
          onChange={(e) => setOfferPrice(e.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClasses}>Short description</label>
        <input className={inputClasses} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} required maxLength={500} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClasses}>Full description</label>
        <textarea className={inputClasses} value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} />
      </div>
      {/* AUDIT FOLLOW-UP ("Admin CMS/content-management pipeline") -- these three fields already existed on ServiceInput/AdminService (used to drive the homepage's Featured Services / New & Noteworthy rails and the live category rails' ordering) but were never exposed in this form. */}
      <div>
        <label className={labelClasses}>Display order (lower shows first)</label>
        <input className={inputClasses} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>
      <div className="flex items-center gap-4 pt-6">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Featured (homepage "Featured Services")
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={isMostBooked} onChange={(e) => setIsMostBooked(e.target.checked)} />
          Most booked (homepage "New & Noteworthy")
        </label>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="md" disabled={saving}>
          {initial ? "Save changes" : "Create service (goes to approval queue)"}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CityAvailabilityEditor({
  service,
  cities,
  onUpdated,
}: {
  service: AdminService;
  cities: AdminCity[];
  onUpdated: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(service.availableCityIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(cityId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await setServiceCityAvailability(
        service.id,
        cities.map((c) => ({ cityId: c.id, active: selected.has(c.id) }))
      );
      onUpdated();
    } catch (err) {
      setError(errorMessage(err, "Could not update city availability."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">City availability</h3>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {cities.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            {c.name}
          </label>
        ))}
      </div>
      <Button size="md" variant="outline" className="mt-2" disabled={saving} onClick={handleSave}>
        Save city availability
      </Button>
    </div>
  );
}

function ServiceImagesEditor({ service, onUpdated }: { service: AdminService; onUpdated: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  // MEDIA LIBRARY FOLLOW-UP: "+ Add Media" opens the shared Central Media
  // Picker (same component/library as Catalog/Homepage) instead of this
  // editor driving its own upload. A service can hold photos AND videos --
  // accept="both" -- distinguished per-item by mediaType.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // ADMIN CMS FOLLOW-UP ("Reorder images / Set primary image"): display order
  // follows sortOrder, not insertion order -- index 0 after sorting is the
  // primary image shown on the service card / gallery cover.
  const sortedImages = [...service.images].sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleAttach(media: { id: string; type: "image" | "video"; url: string; title: string | null; altText: string | null; originalFilename: string }) {
    setAttaching(true);
    setError(null);
    try {
      await attachServiceImage(service.id, {
        mediaId: media.id,
        mediaType: media.type,
        alt: media.altText || media.title || media.originalFilename,
        sortOrder: service.images.length,
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach this media.");
    } finally {
      setAttaching(false);
    }
  }

  async function handleDelete(imageId: string) {
    setError(null);
    try {
      await deleteServiceImage(imageId);
      onUpdated();
    } catch (err) {
      setError(errorMessage(err, "Could not remove this image."));
    }
  }

  /**
   * ADMIN CMS FOLLOW-UP ("Reorder images / Set primary image"): swaps the
   * sortOrder of two images so Move Up/Down can reuse one helper. Persists
   * both changed rows, then refetches via onUpdated().
   */
  async function swapSortOrder(a: AdminServiceImage, b: AdminServiceImage) {
    setError(null);
    setReordering(a.id);
    try {
      await Promise.all([
        updateServiceImage(a.id, { sortOrder: b.sortOrder }),
        updateServiceImage(b.id, { sortOrder: a.sortOrder }),
      ]);
      onUpdated();
    } catch (err) {
      setError(errorMessage(err, "Could not reorder these images."));
    } finally {
      setReordering(null);
    }
  }

  async function handleMoveUp(index: number) {
    if (index <= 0) return;
    await swapSortOrder(sortedImages[index]!, sortedImages[index - 1]!);
  }

  async function handleMoveDown(index: number) {
    if (index >= sortedImages.length - 1) return;
    await swapSortOrder(sortedImages[index]!, sortedImages[index + 1]!);
  }

  async function handleSetPrimary(index: number) {
    if (index <= 0) return;
    setError(null);
    const target = sortedImages[index]!;
    const before = sortedImages.slice(0, index);
    setReordering(target.id);
    try {
      await Promise.all([
        updateServiceImage(target.id, { sortOrder: 0 }),
        ...before.map((img, i) => updateServiceImage(img.id, { sortOrder: i + 1 })),
      ]);
      onUpdated();
    } catch (err) {
      setError(errorMessage(err, "Could not set this image as primary."));
    } finally {
      setReordering(null);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Images ({service.images.length})</h3>
      <p className="mt-0.5 text-xs text-neutral-500">
        The first image is the primary image shown on the service card and gallery cover.
      </p>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      <ul className="mt-2 space-y-2">
        {sortedImages.map((img, index) => (
          <li
            key={img.id}
            className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2 text-xs text-neutral-700"
          >
            {img.mediaType === "video" ? (
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-neutral-800">
                <Icon name="film" className="h-5 w-5 text-white" />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
              <img src={img.url} alt={img.alt} className="h-12 w-12 flex-shrink-0 rounded-md object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-neutral-900">{img.alt}</p>
              <p className="text-[10px] uppercase text-neutral-400">
                {img.mediaType === "video" ? "Video" : "Image"}
                {index === 0 && <span className="ml-1 font-semibold text-brand-600">· Primary</span>}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                className="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                disabled={index === 0 || reordering !== null}
                onClick={() => handleMoveUp(index)}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                disabled={index === sortedImages.length - 1 || reordering !== null}
                onClick={() => handleMoveDown(index)}
              >
                ↓
              </button>
              {index !== 0 && (
                <button
                  type="button"
                  className="rounded border border-brand-300 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40"
                  disabled={reordering !== null}
                  onClick={() => handleSetPrimary(index)}
                >
                  Set primary
                </button>
              )}
              <button type="button" className="text-red-600 hover:underline" onClick={() => handleDelete(img.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
        {service.images.length === 0 && <li className="text-xs text-neutral-500">No images yet.</li>}
      </ul>
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-brand-400 disabled:opacity-50"
        disabled={attaching}
        onClick={() => setPickerOpen(true)}
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
        {attaching ? "Adding…" : "+ Add Media (3–5+ recommended)"}
      </button>
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        accept="both"
        onSelect={(media) => handleAttach(media)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------

function OffersManager() {
  const [offers, setOffers] = useState<AdminOffer[] | null>(null);
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminOffer | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOffers(await listOffersAdmin());
    } catch (err) {
      setError(errorMessage(err, "Could not load offers."));
      setOffers([]);
    }
  }, []);

  useEffect(() => {
    load();
    listCitiesAdmin().then(setCities).catch(() => setCities([]));
  }, [load]);

  async function handleSubmit(input: OfferInput) {
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateOffer(editing.id, input);
      else await createOffer(input);
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not save this offer."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Offers</h2>
          <p className="text-xs text-neutral-500">
            A CITY offer always wins over an ALL_INDIA offer for a matching service — never both, never stacked. The
            discount applies to the service&rsquo;s offer price, never its MRP.
          </p>
        </div>
        <Button
          size="md"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm && !editing ? "Cancel" : "Add Offer"}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      {showForm && (
        <OfferForm
          key={editing?.id ?? "new"}
          cities={cities}
          initial={editing}
          saving={saving}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {offers === null && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {offers !== null && offers.length === 0 && <p className="mt-4 text-sm text-neutral-500">No offers yet.</p>}

      {offers !== null && offers.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{o.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {o.applicabilityType === "all_india" ? "ALL INDIA" : `City: ${cities.find((c) => c.id === o.cityId)?.name ?? o.cityId}`}
                  {" · "}
                  {o.discountType === "percent" ? `${o.discountValue}%` : `₹${o.discountValue}`} off · scope: {o.appliesTo.scope}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill active={o.active} />
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setEditing(o);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="outline" size="md" disabled={saving} onClick={() => handleSubmit({ ...o, active: !o.active })}>
                  {o.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OfferForm({
  cities,
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  cities: AdminCity[];
  initial: AdminOffer | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: OfferInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [discountType, setDiscountType] = useState<"percent" | "flat">(initial?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(initial?.discountValue?.toString() ?? "");
  const [applicabilityType, setApplicabilityType] = useState<"all_india" | "city">(initial?.applicabilityType ?? "all_india");
  const [cityId, setCityId] = useState(initial?.cityId ?? cities[0]?.id ?? "");
  const [scope, setScope] = useState<"all" | "category" | "service">(initial?.appliesTo.scope ?? "all");
  const [idsText, setIdsText] = useState(initial?.appliesTo.ids.join(", ") ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [bannerImage, setBannerImage] = useState<string | null>(initial?.bannerImage ?? null);

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          description,
          discountType,
          discountValue: Number(discountValue),
          applicabilityType,
          cityId: applicabilityType === "city" ? cityId : null,
          appliesTo: {
            scope,
            ids: scope === "all" ? [] : idsText.split(",").map((s) => s.trim()).filter(Boolean),
          },
          startDate: startDate || null,
          endDate: endDate || null,
          bannerImage,
        });
      }}
    >
      <div>
        <label className={labelClasses}>Title</label>
        <input className={inputClasses} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className={labelClasses}>Applicability</label>
        <select className={inputClasses} value={applicabilityType} onChange={(e) => setApplicabilityType(e.target.value as "all_india" | "city")}>
          <option value="all_india">ALL INDIA</option>
          <option value="city">Specific city</option>
        </select>
      </div>
      {applicabilityType === "city" && (
        <div>
          <label className={labelClasses}>City</label>
          <select className={inputClasses} value={cityId} onChange={(e) => setCityId(e.target.value)} required>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelClasses}>Discount type</label>
        <select className={inputClasses} value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "flat")}>
          <option value="percent">Percent</option>
          <option value="flat">Flat amount (₹)</option>
        </select>
      </div>
      <div>
        <label className={labelClasses}>Discount value {discountType === "percent" ? "(%, max 100)" : "(₹)"}</label>
        <input
          className={inputClasses}
          type="number"
          min={0}
          max={discountType === "percent" ? 100 : undefined}
          step="0.01"
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClasses}>Applies to</label>
        <select className={inputClasses} value={scope} onChange={(e) => setScope(e.target.value as "all" | "category" | "service")}>
          <option value="all">All services</option>
          <option value="category">Specific categories</option>
          <option value="service">Specific services</option>
        </select>
      </div>
      {scope !== "all" && (
        <div>
          <label className={labelClasses}>{scope === "category" ? "Category IDs" : "Service IDs"} (comma-separated)</label>
          <input className={inputClasses} value={idsText} onChange={(e) => setIdsText(e.target.value)} />
        </div>
      )}
      <div>
        <label className={labelClasses}>Start date (optional)</label>
        <input className={inputClasses} type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div>
        <label className={labelClasses}>End date (optional)</label>
        <input className={inputClasses} type="date" value={endDate ?? ""} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClasses}>Description</label>
        <textarea className={inputClasses} value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
      </div>
      <MediaPickerField label="Promotional banner image (optional)" accept="image" value={bannerImage} onChange={setBannerImage} />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="md" disabled={saving}>
          {initial ? "Save changes" : "Create offer"}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

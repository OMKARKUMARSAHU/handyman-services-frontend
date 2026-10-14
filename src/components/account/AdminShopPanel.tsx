"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/lib/icons";
import { AdminShopProductForm } from "@/components/account/AdminShopProductForm";
import { AdminShopOrdersView } from "@/components/account/AdminShopOrdersView";
import {
  AuthApiError,
  adjustAdminShopStock,
  createAdminShopCategory,
  deleteAdminShopCategory,
  deleteAdminShopProduct,
  getAdminShopSettings,
  getShopOverview,
  listAdminShopCategories,
  listAdminShopProducts,
  reorderAdminShopCategories,
  seedShopDemoData,
  updateAdminShopCategory,
  updateAdminShopProduct,
  updateAdminShopSettings,
} from "@/lib/admin/shop-api";
import { AdminShopCityPricing } from "@/components/account/AdminShopCityPricing";
import type { PageMeta, ShopAdminProduct, ShopCategory, ShopOverview, ShopSettings } from "@/lib/shop/types";

type SubTab = "products" | "categories" | "orders" | "settings";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "products", label: "Products" },
  { key: "categories", label: "Categories" },
  { key: "orders", label: "Shop orders" },
  { key: "settings", label: "Settings" },
];

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1 block text-xs font-medium text-neutral-700";
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const errMsg = (e: unknown, fallback: string) => (e instanceof AuthApiError || e instanceof Error ? e.message : fallback);

/**
 * Admin "Shop" section — the e-commerce Products area. Namespaced separately
 * from the existing "Catalog → Products" (appliance types for services), which
 * is untouched.
 */
export function AdminShopPanel() {
  const [subTab, setSubTab] = useState<SubTab>("products");
  const [flash, setFlash] = useState<string | null>(null);
  const [overview, setOverview] = useState<ShopOverview | null>(null);

  const refreshOverview = useCallback(() => {
    getShopOverview().then(setOverview).catch(() => setOverview(null));
  }, []);
  useEffect(refreshOverview, [refreshOverview, subTab]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Shop</h2>
        <p className="text-sm text-neutral-600">Manage the public Products section: catalogue, stock and customer orders.</p>
      </div>

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Published products", value: `${overview.publishedProducts} / ${overview.products}`, warn: false },
            { label: "Low stock", value: overview.lowStockProducts, warn: overview.lowStockProducts > 0 },
            { label: "Out of stock", value: overview.outOfStockProducts, warn: overview.outOfStockProducts > 0 },
            { label: "Orders to fulfil", value: overview.ordersToFulfil, warn: false },
            { label: "Awaiting payment", value: overview.ordersAwaitingPayment, warn: false },
            { label: "Paid after closed", value: overview.paidAfterClosed, warn: overview.paidAfterClosed > 0 },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border p-3 ${c.warn ? "border-amber-300 bg-amber-50" : "border-neutral-200"}`}>
              <p className="text-xs text-neutral-500">{c.label}</p>
              <p className="text-lg font-semibold text-neutral-900">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div role="tablist" className="flex gap-2 overflow-x-auto border-b border-neutral-200">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={subTab === t.key}
            type="button"
            onClick={() => {
              setFlash(null);
              setSubTab(t.key);
            }}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${subTab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-600 hover:text-neutral-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {flash && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {flash}
        </p>
      )}

      {subTab === "products" && <ProductsView onFlash={setFlash} onChanged={refreshOverview} />}
      {subTab === "categories" && <CategoriesView onFlash={setFlash} />}
      {subTab === "orders" && <AdminShopOrdersView onChanged={refreshOverview} />}
      {subTab === "settings" && <SettingsView onFlash={setFlash} onChanged={refreshOverview} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
function ProductsView({ onFlash, onChanged }: { onFlash: (m: string | null) => void; onChanged: () => void }) {
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [items, setItems] = useState<ShopAdminProduct[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"" | "draft" | "published">("");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null | "new">(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cats, res] = await Promise.all([
        listAdminShopCategories(),
        listAdminShopProducts({ search: appliedSearch || undefined, categoryId: categoryId || undefined, status: status || undefined, lowStock: lowOnly, page, pageSize: 20 }),
      ]);
      setCategories(cats);
      setItems(res.items);
      setMeta(res.meta);
    } catch (e) {
      setError(errMsg(e, "Could not load products."));
      setItems([]);
    }
  }, [appliedSearch, categoryId, status, lowOnly, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (editing === null) void load();
  }, [load, editing]);

  async function patch(p: ShopAdminProduct, change: Parameters<typeof updateAdminShopProduct>[1], message: string) {
    setBusyId(p.id);
    onFlash(null);
    try {
      await updateAdminShopProduct(p.id, change);
      onFlash(message);
      await load();
      onChanged();
    } catch (e) {
      setError(errMsg(e, "Update failed."));
    } finally {
      setBusyId(null);
    }
  }

  async function restock(p: ShopAdminProduct) {
    const raw = window.prompt(`Set stock for "${p.name}" (current ${p.stockQuantity}). Enter the new total quantity:`, String(p.stockQuantity));
    if (raw === null) return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      setError("Stock must be a whole number, 0 or more.");
      return;
    }
    setBusyId(p.id);
    try {
      await adjustAdminShopStock(p.id, { stockQuantity: n });
      onFlash("Stock updated.");
      await load();
      onChanged();
    } catch (e) {
      setError(errMsg(e, "Could not update stock."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: ShopAdminProduct) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone. Past customer orders keep their own copy of the item details. To just hide it, unpublish it instead.`)) return;
    setBusyId(p.id);
    try {
      await deleteAdminShopProduct(p.id);
      onFlash("Product deleted.");
      await load();
      onChanged();
    } catch (e) {
      setError(errMsg(e, "Could not delete the product."));
    } finally {
      setBusyId(null);
    }
  }

  if (editing !== null) {
    return (
      <AdminShopProductForm
        productId={editing === "new" ? null : editing}
        categories={categories}
        onCancel={() => setEditing(null)}
        onDone={(m) => {
          setEditing(null);
          onFlash(m);
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
          <input className={inputClasses} placeholder="Search name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="submit" className="rounded-lg border border-neutral-300 px-3 text-sm hover:bg-neutral-50" aria-label="Search">
            <Icon name="search" className="h-4 w-4" />
          </button>
        </form>
        <select className="rounded-lg border border-neutral-300 px-2 py-2 text-sm" value={categoryId} onChange={(e) => { setPage(1); setCategoryId(e.target.value); }} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="rounded-lg border border-neutral-300 px-2 py-2 text-sm" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as "" | "draft" | "published"); }} aria-label="Status">
          <option value="">Any status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-neutral-700">
          <input type="checkbox" checked={lowOnly} onChange={(e) => { setPage(1); setLowOnly(e.target.checked); }} /> Low stock only
        </label>
        <button type="button" onClick={() => { onFlash(null); setEditing("new"); }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Icon name="plus" className="h-4 w-4" /> Add product
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {items === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          No products found. Add one, or load demo data from Settings.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((p) => (
                <tr key={p.id} className={busyId === p.id ? "opacity-60" : ""}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-neutral-900">
                      {p.name}
                      {p.isDemo && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">DEMO</span>}
                      {p.featured && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">FEATURED</span>}
                    </p>
                    <p className="text-xs text-neutral-500">{p.sku}</p>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{p.category.name}</td>
                  <td className="px-3 py-2 text-right">
                    {inr(p.price)}
                    {p.mrp != null && <span className="block text-xs text-neutral-400 line-through">{inr(p.mrp)}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={p.stockQuantity === 0 ? "font-semibold text-red-700" : p.lowStock ? "font-semibold text-amber-700" : ""}>{p.stockQuantity}</span>
                    {!p.trackInventory && <span className="block text-xs text-neutral-400">not tracked</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${p.status === "published" ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-700"}`}>{p.status}</span>
                    {!p.active && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">inactive</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                    <button type="button" className="px-1.5 text-brand-700 hover:underline" onClick={() => { onFlash(null); setEditing(p.id); }}>Edit</button>
                    <button type="button" className="px-1.5 text-brand-700 hover:underline" onClick={() => restock(p)}>Stock</button>
                    <button type="button" className="px-1.5 text-brand-700 hover:underline" onClick={() => patch(p, { status: p.status === "published" ? "draft" : "published" }, p.status === "published" ? "Product unpublished." : "Product published.")}>
                      {p.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button type="button" className="px-1.5 text-brand-700 hover:underline" onClick={() => patch(p, { active: !p.active }, p.active ? "Product deactivated." : "Product activated.")}>
                      {p.active ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" className="px-1.5 text-red-600 hover:underline" onClick={() => remove(p)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span className="text-neutral-600">Page {meta.page} of {meta.totalPages} · {meta.total} products</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
function CategoriesView({ onFlash }: { onFlash: (m: string | null) => void }) {
  const [cats, setCats] = useState<ShopCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const load = useCallback(async () => {
    try {
      setCats(await listAdminShopCategories());
    } catch (e) {
      setError(errMsg(e, "Could not load categories."));
      setCats([]);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, message: string) {
    setError(null);
    onFlash(null);
    try {
      await fn();
      onFlash(message);
      await load();
    } catch (e) {
      setError(errMsg(e, "Action failed."));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!cats) return;
    const next = [...cats];
    const t = index + dir;
    if (t < 0 || t >= next.length) return;
    [next[index], next[t]] = [next[t]!, next[index]!];
    await run(() => reorderAdminShopCategories(next.map((c) => c.id)), "Order saved.");
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          void run(async () => {
            await createAdminShopCategory({ name });
            setNewName("");
          }, "Category created.");
        }}
      >
        <input className={`${inputClasses} max-w-sm`} placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={150} />
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Add category</button>
      </form>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {cats === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : cats.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {cats.map((c, idx) => (
            <li key={c.id} className="space-y-2 p-3">
              {editId === c.id ? (
                <div className="space-y-2">
                  <div>
                    <label className={labelClasses}>Name</label>
                    <input className={inputClasses} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={150} />
                  </div>
                  <div>
                    <label className={labelClasses}>Description</label>
                    <textarea className={inputClasses} rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={2000} />
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button type="button" className="rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white" onClick={() => run(async () => { await updateAdminShopCategory(c.id, { name: editName.trim(), description: editDescription.trim() || null }); setEditId(null); }, "Category updated.")}>Save</button>
                    <button type="button" className="rounded-lg border border-neutral-300 px-3 py-1.5" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">
                      {c.name} {!c.active && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">inactive</span>}
                    </p>
                    <p className="text-xs text-neutral-500">/{c.slug} · {c.productCount} product{c.productCount === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <button type="button" aria-label="Move up" disabled={idx === 0} onClick={() => move(idx, -1)} className="px-1.5 disabled:opacity-30">↑</button>
                    <button type="button" aria-label="Move down" disabled={idx === cats.length - 1} onClick={() => move(idx, 1)} className="px-1.5 disabled:opacity-30">↓</button>
                    <button type="button" className="px-1.5 text-brand-700 hover:underline" onClick={() => { setEditId(c.id); setEditName(c.name); setEditDescription(c.description ?? ""); }}>Edit</button>
                    <button type="button" className="px-1.5 text-brand-700 hover:underline" onClick={() => run(() => updateAdminShopCategory(c.id, { active: !c.active }), c.active ? "Category deactivated — its products are hidden from the shop." : "Category activated.")}>
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="px-1.5 text-red-600 hover:underline"
                      onClick={() => {
                        if (c.productCount > 0) {
                          setError(`"${c.name}" still has ${c.productCount} product(s). Move or delete them first, or deactivate the category instead.`);
                          return;
                        }
                        if (window.confirm(`Delete category "${c.name}"?`)) void run(() => deleteAdminShopCategory(c.id), "Category deleted.");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function SettingsView({ onFlash, onChanged }: { onFlash: (m: string | null) => void; onChanged: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [freeThreshold, setFreeThreshold] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [returnInfo, setReturnInfo] = useState("");
  const [lowDefault, setLowDefault] = useState("5");

  useEffect(() => {
    getAdminShopSettings()
      .then((s: ShopSettings) => {
        setDeliveryCharge(String(s.deliveryCharge));
        setFreeThreshold(s.freeDeliveryThreshold == null ? "" : String(s.freeDeliveryThreshold));
        setDeliveryInfo(s.defaultDeliveryInfo ?? "");
        setReturnInfo(s.defaultReturnInfo ?? "");
        setLowDefault(String(s.lowStockThresholdDefault));
        setLoaded(true);
      })
      .catch((e) => {
        setError(errMsg(e, "Could not load settings."));
        setLoaded(true);
      });
  }, []);

  async function save() {
    setError(null);
    onFlash(null);
    const dc = Number(deliveryCharge);
    const ft = freeThreshold.trim() === "" ? null : Number(freeThreshold);
    const ld = Number(lowDefault);
    if (!Number.isFinite(dc) || dc < 0) return setError("Delivery charge must be 0 or more.");
    if (ft !== null && (!Number.isFinite(ft) || ft < 0)) return setError("Free-delivery threshold must be 0 or more, or blank.");
    if (!Number.isInteger(ld) || ld < 0) return setError("Default low-stock threshold must be a whole number.");
    setSaving(true);
    try {
      await updateAdminShopSettings({
        deliveryCharge: dc,
        freeDeliveryThreshold: ft,
        defaultDeliveryInfo: deliveryInfo.trim() || null,
        defaultReturnInfo: returnInfo.trim() || null,
        lowStockThresholdDefault: ld,
      });
      onFlash("Settings saved.");
    } catch (e) {
      setError(errMsg(e, "Could not save settings."));
    } finally {
      setSaving(false);
    }
  }

  async function seed() {
    if (!window.confirm("Load demo categories and products? They are clearly marked DEMO with placeholder prices, and re-running this never duplicates them.")) return;
    setSeeding(true);
    setError(null);
    try {
      const r = await seedShopDemoData();
      onFlash(`Demo data loaded: ${r.categoriesCreated} categories and ${r.productsCreated} products created. They are published and labelled DEMO with placeholder prices — edit or unpublish them before going live.`);
      onChanged();
    } catch (e) {
      setError(errMsg(e, "Could not load demo data."));
    } finally {
      setSeeding(false);
    }
  }

  if (!loaded) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Delivery charge (₹)</label>
          <input className={inputClasses} inputMode="decimal" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} />
        </div>
        <div>
          <label className={labelClasses}>Free delivery above (₹) — blank to always charge</label>
          <input className={inputClasses} inputMode="decimal" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} />
        </div>
        <div>
          <label className={labelClasses}>Default low-stock threshold</label>
          <input className={inputClasses} inputMode="numeric" value={lowDefault} onChange={(e) => setLowDefault(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Default delivery information (shown on products without their own)</label>
          <textarea className={inputClasses} rows={3} value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} maxLength={2000} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Default return policy</label>
          <textarea className={inputClasses} rows={3} value={returnInfo} onChange={(e) => setReturnInfo(e.target.value)} maxLength={2000} />
        </div>
      </section>
      <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {saving ? "Saving…" : "Save settings"}
      </button>

      <AdminShopCityPricing onFlash={onFlash} />

      <section className="rounded-lg border border-neutral-200 p-4">
        <h3 className="text-sm font-semibold text-neutral-900">Demo data</h3>
        <p className="mt-1 text-xs text-neutral-600">
          Loads sample categories and products (water purifiers, filters, AC accessories, cleaning, pest control, tools) so the shop can be reviewed. They go live immediately, labelled DEMO with placeholder prices — edit, unpublish or delete them from the Products tab.
        </p>
        <button type="button" disabled={seeding} onClick={seed} className="mt-3 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50">
          {seeding ? "Loading…" : "Load demo data"}
        </button>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/lib/icons";
import { MediaPicker } from "@/components/account/MediaPicker";
import { AdminShopCityAvailability, type CityRow } from "@/components/account/AdminShopCityAvailability";
import {
  AuthApiError,
  createAdminShopProduct,
  getAdminShopProduct,
  setAdminShopProductCities,
  setAdminShopProductImages,
  setAdminShopProductVideos,
  updateAdminShopProduct,
  type AdminProductInput,
  type AdminVideoInput,
} from "@/lib/admin/shop-api";
import type { ShopCategory, ShopSpecification } from "@/lib/shop/types";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1 block text-xs font-medium text-neutral-700";
const MAX_IMAGES = 6;
const MAX_VIDEOS = 4;

interface ImageRow {
  mediaId: string;
  url: string;
  altText: string;
  isPrimary: boolean;
}
interface VideoRow {
  key: string;
  kind: "youtube" | "upload";
  title: string;
  youtubeUrl: string;
  mediaId: string | null;
  url: string | null;
}

function parseMoney(value: string): number | null {
  const t = value.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Product create/edit form. Core fields are saved with create/update; images
 * and videos are replaced via their own endpoints afterwards (both pick from
 * the existing Media Library — no new upload path, no S3 credentials in the
 * browser).
 */
export function AdminShopProductForm({
  productId,
  categories,
  onDone,
  onCancel,
}: {
  productId: string | null;
  categories: ShopCategory[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(productId !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [stock, setStock] = useState("0");
  const [lowStock, setLowStock] = useState("5");
  const [trackInventory, setTrackInventory] = useState(true);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [active, setActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [specs, setSpecs] = useState<ShopSpecification[]>([]);
  const [models, setModels] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [returnInfo, setReturnInfo] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [images, setImages] = useState<ImageRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [cityRows, setCityRows] = useState<CityRow[] | null>(null);
  const [picker, setPicker] = useState<null | "image" | "video">(null);
  const [youtubeDraft, setYoutubeDraft] = useState("");

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    getAdminShopProduct(productId)
      .then((p) => {
        if (cancelled) return;
        setName(p.name);
        setSlug(p.slug);
        setSku(p.sku);
        setCategoryId(p.categoryId);
        setShortDescription(p.shortDescription ?? "");
        setDescription(p.description ?? "");
        setPrice(String(p.price));
        setMrp(p.mrp == null ? "" : String(p.mrp));
        setStock(String(p.stockQuantity));
        setLowStock(String(p.lowStockThreshold));
        setTrackInventory(p.trackInventory);
        setStatus(p.status);
        setActive(p.active);
        setFeatured(p.featured);
        setSpecs(p.specifications);
        setModels(p.compatibleModels.join("\n"));
        setDeliveryInfo(p.deliveryInfo ?? "");
        setReturnInfo(p.returnInfo ?? "");
        setSeoTitle(p.seoTitle ?? "");
        setSeoDescription(p.seoDescription ?? "");
        setIsDemo(p.isDemo);
        setImages(p.images.map((i) => ({ mediaId: i.mediaId, url: i.url, altText: i.altText ?? "", isPrimary: i.isPrimary })));
        setVideos(
          p.videos.map((v) => ({
            key: v.id,
            kind: v.kind,
            title: v.title ?? "",
            youtubeUrl: v.watchUrl ?? "",
            mediaId: v.mediaId,
            url: v.url,
          }))
        );
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the product.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  function moveImage(index: number, dir: -1 | 1) {
    setImages((rows) => {
      const next = [...rows];
      const target = index + dir;
      if (target < 0 || target >= next.length) return rows;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function validate(): AdminProductInput | null {
    const errs: Record<string, string> = {};
    const priceN = parseMoney(price);
    const mrpN = parseMoney(mrp);
    const stockN = Number(stock);
    const lowN = Number(lowStock);
    if (!name.trim()) errs.name = "Name is required.";
    if (!sku.trim()) errs.sku = "SKU is required.";
    if (!categoryId) errs.categoryId = "Choose a category.";
    if (priceN === null || Number.isNaN(priceN) || priceN <= 0) errs.price = "Enter a price greater than 0.";
    if (mrpN !== null && (Number.isNaN(mrpN) || mrpN <= 0)) errs.mrp = "Enter a valid MRP or leave it blank.";
    if (mrpN !== null && !Number.isNaN(mrpN) && priceN !== null && !Number.isNaN(priceN) && mrpN < priceN) errs.mrp = "MRP cannot be lower than the price.";
    if (!Number.isInteger(stockN) || stockN < 0) errs.stock = "Stock must be a whole number, 0 or more.";
    if (!Number.isInteger(lowN) || lowN < 0) errs.lowStock = "Threshold must be a whole number, 0 or more.";
    const badCity = cityRows?.find((r) => {
      const t = r.priceOverride.trim();
      if (!r.available || t === "") return false;
      const n = Number(t);
      return !Number.isFinite(n) || n <= 0;
    });
    if (badCity) errs.cityPrice = `Enter a valid price for ${badCity.name} (greater than 0) or leave it blank.`;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return null;
    return {
      categoryId,
      name: name.trim(),
      ...(slug.trim() ? { slug: slug.trim() } : {}),
      sku: sku.trim(),
      shortDescription: shortDescription.trim() || null,
      description: description.trim() || null,
      price: priceN as number,
      mrp: mrpN,
      stockQuantity: stockN,
      lowStockThreshold: lowN,
      trackInventory,
      status,
      active,
      featured,
      specifications: specs.filter((s) => s.label.trim() && s.value.trim()).map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
      compatibleModels: models.split("\n").map((m) => m.trim()).filter(Boolean),
      deliveryInfo: deliveryInfo.trim() || null,
      returnInfo: returnInfo.trim() || null,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
    };
  }

  async function save() {
    setError(null);
    const input = validate();
    if (!input) return;
    setSaving(true);
    try {
      const saved = productId ? await updateAdminShopProduct(productId, input) : await createAdminShopProduct(input);

      const primaryIndex = images.findIndex((i) => i.isPrimary);
      await setAdminShopProductImages(
        saved.id,
        images.map((i, idx) => ({ mediaId: i.mediaId, altText: i.altText.trim() || null, isPrimary: primaryIndex === -1 ? idx === 0 : idx === primaryIndex }))
      );
      const videoInputs: AdminVideoInput[] = [];
      for (const v of videos) {
        if (v.kind === "youtube") videoInputs.push({ kind: "youtube", url: v.youtubeUrl, title: v.title.trim() || null });
        else if (v.mediaId) videoInputs.push({ kind: "upload", mediaId: v.mediaId, title: v.title.trim() || null });
      }
      await setAdminShopProductVideos(saved.id, videoInputs);
      if (cityRows) {
        await setAdminShopProductCities(
          saved.id,
          cityRows.map((r) => ({ cityId: r.cityId, available: r.available, priceOverride: r.available && r.priceOverride.trim() !== "" ? Number(r.priceOverride) : null }))
        );
      }
      onDone(productId ? "Product updated." : "Product created.");
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
        const details = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
        if (details?.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(details.fieldErrors)) if (v?.[0]) mapped[k] = v[0];
          setFieldErrors(mapped);
        }
      } else {
        setError("Could not save the product.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading product…</p>;

  const fieldError = (k: string) => (fieldErrors[k] ? <p className="mt-1 text-xs text-red-600">{fieldErrors[k]}</p> : null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{productId ? "Edit product" : "New product"}</h2>
        <button type="button" onClick={onCancel} className="text-sm text-neutral-600 hover:text-neutral-900">
          ← Back to products
        </button>
      </div>
      {isDemo && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This is a demo product with placeholder pricing. Update the price, MRP and details before publishing for real customers.
        </p>
      )}
      {categories.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Create a category first (Shop → Categories) — every product needs one.</p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClasses}>Name *</label>
          <input className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
          {fieldError("name")}
        </div>
        <div>
          <label className={labelClasses}>SKU *</label>
          <input className={inputClasses} value={sku} onChange={(e) => setSku(e.target.value)} maxLength={80} />
          {fieldError("sku")}
        </div>
        <div>
          <label className={labelClasses}>Category *</label>
          <select className={inputClasses} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
          {fieldError("categoryId")}
        </div>
        <div>
          <label className={labelClasses}>Selling price (₹) *</label>
          <input className={inputClasses} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          {fieldError("price")}
        </div>
        <div>
          <label className={labelClasses}>MRP (₹) — optional, shows the discount</label>
          <input className={inputClasses} inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} />
          {fieldError("mrp")}
        </div>
        <div>
          <label className={labelClasses}>Stock quantity *</label>
          <input className={inputClasses} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
          {fieldError("stockQuantity")}
          {fieldError("stock")}
        </div>
        <div>
          <label className={labelClasses}>Low-stock alert at</label>
          <input className={inputClasses} inputMode="numeric" value={lowStock} onChange={(e) => setLowStock(e.target.value)} />
          {fieldError("lowStock")}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>URL slug — leave blank to generate from the name</label>
          <input className={inputClasses} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={160} />
          {fieldError("slug")}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} /> Track inventory
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (can be bought)
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            Status
            <select className="rounded-lg border border-neutral-300 px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
              <option value="draft">Draft (hidden)</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <label className={labelClasses}>Short description (shown on cards)</label>
          <input className={inputClasses} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={500} />
        </div>
        <div>
          <label className={labelClasses}>Full description</label>
          <textarea className={inputClasses} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={20000} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Images ({images.length}/{MAX_IMAGES})</h3>
          <button
            type="button"
            disabled={images.length >= MAX_IMAGES}
            onClick={() => setPicker("image")}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            Add from Media Library
          </button>
        </div>
        {images.length === 0 ? (
          <p className="text-xs text-neutral-500">No images yet. The first image is the primary one unless you choose another.</p>
        ) : (
          <ul className="space-y-2">
            {images.map((img, idx) => (
              <li key={img.mediaId} className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-14 w-14 rounded object-cover" />
                <input
                  className={`${inputClasses} min-w-[10rem] flex-1`}
                  placeholder="Alt text"
                  value={img.altText}
                  onChange={(e) => setImages((rows) => rows.map((r, i) => (i === idx ? { ...r, altText: e.target.value } : r)))}
                />
                <label className="flex items-center gap-1 text-xs text-neutral-700">
                  <input
                    type="radio"
                    name="primary-image"
                    checked={img.isPrimary || (idx === 0 && !images.some((i) => i.isPrimary))}
                    onChange={() => setImages((rows) => rows.map((r, i) => ({ ...r, isPrimary: i === idx })))}
                  />
                  Primary
                </label>
                <button type="button" aria-label="Move up" disabled={idx === 0} onClick={() => moveImage(idx, -1)} className="px-1 text-neutral-600 disabled:opacity-30">
                  ↑
                </button>
                <button type="button" aria-label="Move down" disabled={idx === images.length - 1} onClick={() => moveImage(idx, 1)} className="px-1 text-neutral-600 disabled:opacity-30">
                  ↓
                </button>
                <button type="button" aria-label="Remove image" onClick={() => setImages((rows) => rows.filter((_, i) => i !== idx))} className="text-red-600">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Videos ({videos.length}/{MAX_VIDEOS})</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputClasses} min-w-[12rem] flex-1`}
            placeholder="YouTube link (watch, share or embed URL)"
            value={youtubeDraft}
            onChange={(e) => setYoutubeDraft(e.target.value)}
          />
          <button
            type="button"
            disabled={!youtubeDraft.trim() || videos.length >= MAX_VIDEOS}
            onClick={() => {
              setVideos((v) => [...v, { key: `new-${Date.now()}`, kind: "youtube", title: "", youtubeUrl: youtubeDraft.trim(), mediaId: null, url: null }]);
              setYoutubeDraft("");
            }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            Add YouTube video
          </button>
          <button
            type="button"
            disabled={videos.length >= MAX_VIDEOS}
            onClick={() => setPicker("video")}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            Add uploaded video
          </button>
        </div>
        {videos.length > 0 && (
          <ul className="mt-3 space-y-2">
            {videos.map((v, idx) => (
              <li key={v.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 p-2 text-xs">
                <span className="rounded bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">{v.kind === "youtube" ? "YouTube" : "Upload"}</span>
                <span className="min-w-0 flex-1 truncate text-neutral-600">{v.kind === "youtube" ? v.youtubeUrl : v.url ?? v.mediaId}</span>
                <input
                  className={`${inputClasses} w-48`}
                  placeholder="Title (optional)"
                  value={v.title}
                  onChange={(e) => setVideos((rows) => rows.map((r, i) => (i === idx ? { ...r, title: e.target.value } : r)))}
                />
                <button type="button" aria-label="Remove video" onClick={() => setVideos((rows) => rows.filter((_, i) => i !== idx))} className="text-red-600">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminShopCityAvailability productId={productId} basePrice={Number(price)} rows={cityRows} onChange={setCityRows} onLoaded={setCityRows} />
      {fieldErrors.cityPrice && (
        <p role="alert" className="text-xs text-red-700">
          {fieldErrors.cityPrice}
        </p>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Specifications</h3>
          <button type="button" onClick={() => setSpecs((s) => [...s, { label: "", value: "" }])} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
            Add row
          </button>
        </div>
        <div className="space-y-2">
          {specs.map((s, idx) => (
            <div key={idx} className="flex gap-2">
              <input className={inputClasses} placeholder="Label" value={s.label} onChange={(e) => setSpecs((rows) => rows.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)))} />
              <input className={inputClasses} placeholder="Value" value={s.value} onChange={(e) => setSpecs((rows) => rows.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))} />
              <button type="button" aria-label="Remove row" onClick={() => setSpecs((rows) => rows.filter((_, i) => i !== idx))} className="text-red-600">
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClasses}>Compatible models — one per line (only list what is verified)</label>
          <textarea className={inputClasses} rows={3} value={models} onChange={(e) => setModels(e.target.value)} />
        </div>
        <div>
          <label className={labelClasses}>Delivery information (blank = store default)</label>
          <textarea className={inputClasses} rows={3} value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} maxLength={2000} />
        </div>
        <div>
          <label className={labelClasses}>Return policy (blank = store default)</label>
          <textarea className={inputClasses} rows={3} value={returnInfo} onChange={(e) => setReturnInfo(e.target.value)} maxLength={2000} />
        </div>
        <div>
          <label className={labelClasses}>SEO title</label>
          <input className={inputClasses} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={255} />
        </div>
        <div>
          <label className={labelClasses}>SEO description</label>
          <input className={inputClasses} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={500} />
        </div>
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving || categories.length === 0}
          onClick={save}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : productId ? "Save changes" : "Create product"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:bg-neutral-50">
          Cancel
        </button>
      </div>

      <MediaPicker
        open={picker !== null}
        accept={picker === "video" ? "video" : "image"}
        onClose={() => setPicker(null)}
        onSelect={(media) => {
          if (picker === "image") {
            setImages((rows) =>
              rows.some((r) => r.mediaId === media.id) || rows.length >= MAX_IMAGES
                ? rows
                : [...rows, { mediaId: media.id, url: media.url, altText: media.altText ?? "", isPrimary: false }]
            );
          } else if (picker === "video") {
            setVideos((rows) =>
              rows.some((r) => r.mediaId === media.id) || rows.length >= MAX_VIDEOS
                ? rows
                : [...rows, { key: `new-${media.id}`, kind: "upload", title: media.title ?? "", youtubeUrl: "", mediaId: media.id, url: media.url }]
            );
          }
          setPicker(null);
        }}
      />
    </div>
  );
}

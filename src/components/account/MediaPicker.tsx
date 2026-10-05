"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/lib/icons";
import { ACCEPTED_MEDIA_TYPES, listMedia, uploadMedia, type Media, type MediaType } from "@/lib/admin/media-library-api";

/**
 * Central Media Library — reusable Admin UI (Admin CMS follow-up, "Central
 * Media Picker"). Two things live here:
 *
 * - `MediaPicker`: the modal itself -- search/filter the library, pick an
 *   existing item, or switch to the "Upload new media" tab. Used directly
 *   by anything that needs to know WHICH media was picked beyond just a
 *   URL (`ServiceImagesEditor` in AdminCatalogPanel.tsx, which attaches it
 *   to a service with ordering/primary semantics).
 * - `MediaPickerField`: a drop-in replacement for the old, duplicated
 *   `ImageUploadField` (previously defined separately in both
 *   AdminCatalogPanel.tsx and AdminHomepageContentPanel.tsx) for every
 *   admin field that's just "one image/video URL" -- category/product
 *   image, city icon, offer banner, a homepage-section item's
 *   thumbnail/video. Same `{value, onChange}` contract those had, so
 *   swapping it in is a one-line change at each call site.
 *
 * Neither component talks to an entity's own update endpoint -- that
 * stays the caller's job (unchanged), so nothing about how
 * categories/products/cities/offers/homepage sections persist their image
 * fields changes. This only changes WHERE the URL comes from.
 */

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1 block text-xs font-medium text-neutral-700";

type PickerTab = "library" | "upload";
type Accept = "image" | "video" | "both";

export function MediaPicker({
  open,
  onClose,
  onSelect,
  accept = "both",
  initialTab = "library",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (media: Media) => void;
  accept?: Accept;
  initialTab?: PickerTab;
}) {
  const [tab, setTab] = useState<PickerTab>(initialTab);
  const [items, setItems] = useState<Media[] | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaType | "all">(accept === "both" ? "all" : accept);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  async function load() {
    setError(null);
    try {
      const result = await listMedia({
        type: typeFilter === "all" ? undefined : typeFilter,
        search: search || undefined,
        activeOnly: true,
        pageSize: 60,
      });
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the media library.");
      setItems([]);
    }
  }

  useEffect(() => {
    if (open && tab === "library") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, typeFilter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-900">Media Library</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-neutral-200 px-5">
          <TabButton active={tab === "library"} onClick={() => setTab("library")}>
            Select from Media Library
          </TabButton>
          <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
            Upload New Media
          </TabButton>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}
          {tab === "library" ? (
            <LibraryTab
              items={items}
              accept={accept}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              search={search}
              onSearchChange={setSearch}
              onSearchSubmit={load}
              onSelect={(media) => {
                onSelect(media);
                onClose();
              }}
            />
          ) : (
            <UploadTab
              accept={accept}
              onUploaded={(media) => {
                onSelect(media);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-500 hover:text-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

function LibraryTab({
  items,
  accept,
  typeFilter,
  onTypeFilterChange,
  search,
  onSearchChange,
  onSearchSubmit,
  onSelect,
}: {
  items: Media[] | null;
  accept: Accept;
  typeFilter: MediaType | "all";
  onTypeFilterChange: (t: MediaType | "all") => void;
  search: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onSelect: (m: Media) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          />
          <input
            className={`${inputClasses} pl-8`}
            placeholder="Search by title, filename, alt text…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearchSubmit();
            }}
          />
        </div>
        {accept === "both" && (
          <div className="flex gap-1">
            {(["all", "image", "video"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTypeFilterChange(t)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                  typeFilter === t
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {t === "all" ? "All" : t === "image" ? "Images" : "Videos"}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onSearchSubmit}
          className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Search
        </button>
      </div>

      {items === null ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No media found. Try the &ldquo;Upload New Media&rdquo; tab.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className="group overflow-hidden rounded-xl border border-neutral-200 text-left hover:border-brand-400"
            >
              <div className="relative flex aspect-square items-center justify-center bg-neutral-100">
                {m.type === "video" ? (
                  <span className="flex h-full w-full items-center justify-center bg-neutral-800">
                    <Icon name="film" className="h-6 w-6 text-white" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- library thumbnail
                  <img src={m.url} alt={m.altText ?? ""} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-neutral-800">{m.title || m.originalFilename}</p>
                <p className="truncate text-[11px] text-neutral-400">{m.type}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadTab({ accept, onUploaded }: { accept: Accept; onUploaded: (m: Media) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptAttr =
    accept === "image"
      ? "image/jpeg,image/png,image/webp,image/gif"
      : accept === "video"
        ? "video/mp4,video/webm,video/quicktime"
        : ACCEPTED_MEDIA_TYPES;

  function handleFileChange(f: File | null) {
    setFile(f);
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f && !f.type.startsWith("video/") ? URL.createObjectURL(f) : null;
    });
  }

  async function handleSubmit() {
    if (!file) {
      setError("Choose a photo or video first.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const media = await uploadMedia(file, {
        title: title || undefined,
        seoTitle: seoTitle || undefined,
        altText: altText || undefined,
        description: description || undefined,
      });
      onUploaded(media);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this file.");
    } finally {
      setUploading(false);
    }
  }

  const isVideo = file?.type.startsWith("video/") ?? false;

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClasses}>Photo or video</label>
        <input
          type="file"
          accept={acceptAttr}
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-neutral-700"
        />
        {file && (
          <div className="mt-2">
            {isVideo || !previewUrl ? (
              <p className="text-xs text-neutral-600">{file.name}</p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- local file preview
              <img src={previewUrl} alt="" className="h-24 w-24 rounded-lg object-cover ring-1 ring-neutral-200" />
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500">
        All of the fields below are optional — you can upload without filling any of them in.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Title (optional)</label>
          <input className={inputClasses} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={labelClasses}>SEO title (optional)</label>
          <input className={inputClasses} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        </div>
        {!isVideo && (
          <div>
            <label className={labelClasses}>Alt text (optional)</label>
            <input className={inputClasses} value={altText} onChange={(e) => setAltText(e.target.value)} />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={labelClasses}>Description (optional)</label>
          <textarea className={inputClasses} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={uploading || !file}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload"}
      </button>
    </div>
  );
}

/**
 * Drop-in replacement for the old per-component `ImageUploadField`. Same
 * `{value, onChange}` contract (a plain URL string) -- the caller still
 * owns persisting that URL onto its own entity field exactly as before.
 */
export function MediaPickerField({
  label,
  value,
  onChange,
  accept = "image",
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: Accept;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>("library");

  function openPicker(tab: PickerTab) {
    setPickerTab(tab);
    setPickerOpen(true);
  }

  return (
    <div className="sm:col-span-2">
      <label className={labelClasses}>{label}</label>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        {value ? (
          accept === "video" ? (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-800 ring-1 ring-neutral-200">
              <Icon name="film" className="h-5 w-5 text-white" />
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- admin-selected preview thumbnail
            <img src={value} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-neutral-200" />
          )
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 ring-1 ring-neutral-200">
            <Icon name="package" className="h-5 w-5" />
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openPicker("library")}
            className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:border-brand-400"
          >
            Select from Media Library
          </button>
          <button
            type="button"
            onClick={() => openPicker("upload")}
            className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:border-brand-400"
          >
            Upload New Media
          </button>
          {value && (
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => onChange(null)}>
              Remove
            </button>
          )}
        </div>
      </div>
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        accept={accept}
        initialTab={pickerTab}
        onSelect={(media) => onChange(media.url)}
      />
    </div>
  );
}

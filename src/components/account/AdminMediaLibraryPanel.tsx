"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import { MediaPicker } from "@/components/account/MediaPicker";
import {
  AuthApiError,
  MediaInUseError,
  deleteMedia,
  listMedia,
  updateMedia,
  type Media,
  type MediaType,
} from "@/lib/admin/media-library-api";

/**
 * Admin sidebar "Media" tab — the Media Library's own management screen
 * (list every uploaded photo/video, upload new ones, edit metadata,
 * delete-with-reference-check or deactivate). Selecting media FOR another
 * entity (a service, a category, a homepage section, …) happens through
 * the shared `MediaPicker`/`MediaPickerField` instead — this page is only
 * for managing the library itself.
 */
export function AdminMediaLibraryPanel() {
  const [items, setItems] = useState<Media[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaType | "all">("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Media | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await listMedia({
        type: typeFilter === "all" ? undefined : typeFilter,
        search: search || undefined,
        pageSize: 100,
      });
      setItems(result.items);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not load the media library.");
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  async function handleDelete(media: Media) {
    if (!window.confirm(`Delete "${media.title || media.originalFilename}"? This can't be undone.`)) return;
    try {
      await deleteMedia(media.id);
      await load();
    } catch (err) {
      if (err instanceof MediaInUseError) {
        const list = err.references.map((r) => `- ${r.label}`).join("\n");
        const deactivateInstead = window.confirm(
          `This media is still attached in ${err.references.length} place(s):\n${list}\n\n` +
            "It can't be deleted while anything uses it. Deactivate it instead? " +
            "(It stays attached wherever it's used, but is hidden from the picker for new selections.)"
        );
        if (deactivateInstead) {
          await updateMedia(media.id, { active: false });
          await load();
        }
      } else {
        setError(err instanceof Error ? err.message : "Could not delete this media.");
      }
    }
  }

  async function handleToggleActive(media: Media) {
    try {
      await updateMedia(media.id, { active: !media.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this media.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Media Library</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Every photo and video uploaded through the Admin Panel. Pick from here anywhere you see &ldquo;Select
            from Media Library&rdquo; — the same file is reused instead of being uploaded again.
          </p>
        </div>
        <Button type="button" onClick={() => setUploadOpen(true)}>
          <Icon name="plus" className="h-4 w-4" />
          Upload Media
        </Button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
        />
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Search
        </button>
        <div className="flex gap-1">
          {(["all", "image", "video"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
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
      </div>

      {items === null ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No media uploaded yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((m) => (
            <div
              key={m.id}
              className={`overflow-hidden rounded-xl border bg-white ${m.active ? "border-neutral-200" : "border-neutral-200 opacity-60"}`}
            >
              <div className="relative flex aspect-square items-center justify-center bg-neutral-100">
                {m.type === "video" ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption -- silent muted preview only
                  <video src={m.url} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- library thumbnail
                  <img src={m.url} alt={m.altText ?? ""} className="h-full w-full object-cover" />
                )}
                {!m.active && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-neutral-900/70 px-2 py-0.5 text-[10px] font-medium text-white">
                    Inactive
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-medium text-neutral-900">{m.title || m.originalFilename}</p>
                <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                  {m.type} · {formatBytes(m.fileSizeBytes)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-100"
                    onClick={() => setEditing(m)}
                    aria-label="Edit details"
                  >
                    <Icon name="pencil" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-100"
                    onClick={() => handleToggleActive(m)}
                    aria-label={m.active ? "Deactivate" : "Activate"}
                  >
                    <Icon name={m.active ? "eye" : "eye-off"} className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(m)}
                    aria-label="Delete"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MediaPicker open={uploadOpen} onClose={() => setUploadOpen(false)} accept="both" initialTab="upload" onSelect={() => load()} />

      {editing && (
        <EditMediaModal
          media={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "legacy";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EditMediaModal({ media, onClose, onSaved }: { media: Media; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(media.title ?? "");
  const [seoTitle, setSeoTitle] = useState(media.seoTitle ?? "");
  const [altText, setAltText] = useState(media.altText ?? "");
  const [description, setDescription] = useState(media.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateMedia(media.id, {
        title: title || undefined,
        seoTitle: seoTitle || undefined,
        altText: altText || undefined,
        description: description || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this media's details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Edit media details</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3">
          {media.type === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- admin preview only
            <video src={media.url} className="h-28 w-full rounded-lg bg-neutral-900 object-cover" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview only
            <img src={media.url} alt="" className="h-28 w-full rounded-lg object-cover" />
          )}
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Title</label>
            <input
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">SEO title</label>
            <input
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
            />
          </div>
          {media.type === "image" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Alt text</label>
              <input
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Description</label>
            <textarea
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

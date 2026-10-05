"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import { MediaPickerField } from "@/components/account/MediaPicker";
import {
  AuthApiError,
  listHomepageSectionsAdmin,
  createHomepageSection,
  updateHomepageSection,
  type AdminHomepageSection,
  type HomepageSectionItem,
} from "@/lib/admin/content-api";

/**
 * Admin Homepage Content — AUDIT FOLLOW-UP ("Admin CMS/content-management
 * pipeline"). Manages the two homepage collections the audit's examples 2
 * and 8 called out as hardcoded: the trust/service-benefit strip (backend
 * `homepage_sections.whyChooseUs`, rendered by `TrustStrip.tsx`) and the
 * "Real service visits, on video" curations (backend
 * `homepage_sections.video-curations`, rendered by `VideoCurationRail.tsx`
 * via `getVideoCurationsLive`). Both already had a full, admin-gated CRUD
 * API on the backend (`backend/src/modules/content/*`, reused — not
 * duplicated — from the existing generic `homepage_sections` table); this
 * panel is the first frontend surface for it. `content-api.ts` is this
 * panel's typed client for that module.
 *
 * Each `items` array IS the display order (there is no separate per-item
 * sortOrder column on this generic table) — "reorder" below means moving
 * an item's position in that array, saved as one `PATCH
 * /admin/homepage-sections/:key { items }` call, same as every other
 * change here. An `active: 0` flag hides a video-curation card on the
 * customer site (`getVideoCurationsLive` filters on it) and, for a trust-
 * strip item, hides it too (`TrustStrip.tsx` filters the same way) —
 * leaving `active` unset keeps an item visible, so existing/seeded rows
 * are never silently hidden by this panel.
 */
export function AdminHomepageContentPanel() {
  const [sections, setSections] = useState<AdminHomepageSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    try {
      setSections(await listHomepageSectionsAdmin());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not load homepage content.");
      setSections([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveItems(key: string, heading: string, items: HomepageSectionItem[]) {
    setSaving(true);
    setError(null);
    try {
      const existing = sections?.find((s) => s.key === key);
      if (existing) {
        await updateHomepageSection(key, { items });
      } else {
        // The "video-curations" key is seeded by the backend seed script, but
        // a fresh database (or a renamed key) may not have it yet — create it
        // on first save rather than erroring.
        await createHomepageSection({ key, heading, items });
      }
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not save this section.");
    } finally {
      setSaving(false);
    }
  }

  if (sections === null && !error) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  const whyChooseUs = sections?.find((s) => s.key === "whyChooseUs") ?? null;
  const videoCurations = sections?.find((s) => s.key === "video-curations") ?? null;

  return (
    <div className="space-y-8">
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <Card>
        <h2 className="text-base font-semibold text-neutral-900">Trust / service benefit strip</h2>
        <p className="mt-1 text-xs text-neutral-500">
          The compact row under the hero on the customer homepage ("Dedicated Technician Visits", "No Hidden
          Charges", …). Changes appear on the live site within about 30 seconds.
        </p>
        <TrustStripEditor
          items={(whyChooseUs?.items as HomepageSectionItem[] | null) ?? []}
          saving={saving}
          onSave={(items) => saveItems("whyChooseUs", "Why Choose Handyman Services", items)}
        />
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-neutral-900">Real service visits, on video</h2>
        <p className="mt-1 text-xs text-neutral-500">
          The "See It In Action" homepage section. A curation with no video uploaded shows "Video coming soon" on
          the customer site instead of breaking the layout.
        </p>
        <VideoCurationsEditor
          items={(videoCurations?.items as HomepageSectionItem[] | null) ?? []}
          saving={saving}
          onSave={(items) => saveItems("video-curations", "Real service visits, on video", items)}
        />
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-6">{children}</div>;
}

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1 block text-xs font-medium text-neutral-700";

// MEDIA LIBRARY FOLLOW-UP: the old local ImageUploadField (homepage-scoped
// CMS presign upload only) is gone -- MediaPickerField (the same Central
// Media Picker used throughout Catalog) now backs both the thumbnail and
// video fields below, so homepage media is reused from, and added to, the
// same single library instead of a separate homepage-only upload path.

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ---------------------------------------------------------------------
// Trust strip items
// ---------------------------------------------------------------------

interface TrustStripDraft {
  icon: string;
  title: string;
  description: string;
  active: boolean;
}

function toDraftList(items: HomepageSectionItem[]): TrustStripDraft[] {
  return items.map((it) => ({
    icon: String(it.icon ?? "shield-check"),
    title: String(it.title ?? ""),
    description: String(it.description ?? ""),
    active: it.active === undefined || Number(it.active) === 1,
  }));
}

function TrustStripEditor({
  items,
  saving,
  onSave,
}: {
  items: HomepageSectionItem[];
  saving: boolean;
  onSave: (items: HomepageSectionItem[]) => void;
}) {
  const [drafts, setDrafts] = useState<TrustStripDraft[]>(() => toDraftList(items));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDrafts(toDraftList(items));
    setDirty(false);
    // Only re-sync from the server when the underlying item count/identity
    // actually changes (e.g. after a save) — not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items)]);

  function update(i: number, patch: Partial<TrustStripDraft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
    setDirty(true);
  }

  function reorder(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= drafts.length) return;
    setDrafts((prev) => move(prev, i, j));
    setDirty(true);
  }

  function remove(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  function add() {
    setDrafts((prev) => [...prev, { icon: "shield-check", title: "", description: "", active: true }]);
    setDirty(true);
  }

  function handleSave() {
    const items: HomepageSectionItem[] = drafts.map((d) => ({
      icon: d.icon,
      title: d.title,
      description: d.description,
      active: d.active ? 1 : 0,
    }));
    onSave(items);
    setDirty(false);
  }

  return (
    <div className="mt-4 space-y-3">
      {drafts.map((d, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className={labelClasses}>Icon key</label>
            <input className={inputClasses} value={d.icon} onChange={(e) => update(i, { icon: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses}>Title</label>
            <input className={inputClasses} value={d.title} onChange={(e) => update(i, { title: e.target.value })} />
          </div>
          <div className="flex items-end gap-1">
            <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Move up">
              <Icon name="chevron-left" className="h-3.5 w-3.5 rotate-90" />
            </button>
            <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={i === drafts.length - 1} onClick={() => reorder(i, 1)} aria-label="Move down">
              <Icon name="chevron-right" className="h-3.5 w-3.5 rotate-90" />
            </button>
            <label className="flex items-center gap-1 px-1 text-xs text-neutral-700">
              <input type="checkbox" checked={d.active} onChange={(e) => update(i, { active: e.target.checked })} />
              Active
            </label>
            <button type="button" className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" onClick={() => remove(i)} aria-label="Remove">
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="sm:col-span-3">
            <label className={labelClasses}>Description</label>
            <input className={inputClasses} value={d.description} onChange={(e) => update(i, { description: e.target.value })} />
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="md" onClick={add}>
          Add item
        </Button>
        <Button type="button" size="md" disabled={saving || !dirty} onClick={handleSave}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Video curations
// ---------------------------------------------------------------------

interface VideoCurationDraft {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  serviceTypeId: string;
  thumbnail: string | null;
  videoUrl: string | null;
  externalUrl: string;
  durationSeconds: string;
  active: boolean;
}

function toVideoDraftList(items: HomepageSectionItem[]): VideoCurationDraft[] {
  return items.map((it) => ({
    id: String(it.id ?? crypto.randomUUID()),
    title: String(it.title ?? ""),
    description: it.description !== undefined ? String(it.description) : "",
    categoryId: it.categoryId !== undefined ? String(it.categoryId) : "",
    serviceTypeId: it.serviceTypeId !== undefined ? String(it.serviceTypeId) : "",
    thumbnail: it.thumbnail !== undefined ? String(it.thumbnail) : null,
    videoUrl: it.videoUrl !== undefined ? String(it.videoUrl) : null,
    externalUrl: it.externalUrl !== undefined ? String(it.externalUrl) : "",
    durationSeconds: it.durationSeconds !== undefined ? String(it.durationSeconds) : "",
    active: it.active === undefined || Number(it.active) === 1,
  }));
}

function VideoCurationsEditor({
  items,
  saving,
  onSave,
}: {
  items: HomepageSectionItem[];
  saving: boolean;
  onSave: (items: HomepageSectionItem[]) => void;
}) {
  const [drafts, setDrafts] = useState<VideoCurationDraft[]>(() => toVideoDraftList(items));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDrafts(toVideoDraftList(items));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items)]);

  function update(i: number, patch: Partial<VideoCurationDraft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
    setDirty(true);
  }

  function reorder(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= drafts.length) return;
    setDrafts((prev) => move(prev, i, j));
    setDirty(true);
  }

  function remove(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  function add() {
    setDrafts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: "",
        description: "",
        categoryId: "",
        serviceTypeId: "",
        thumbnail: null,
        videoUrl: null,
        externalUrl: "",
        durationSeconds: "",
        active: true,
      },
    ]);
    setDirty(true);
  }

  function handleSave() {
    const items: HomepageSectionItem[] = drafts.map((d, idx) => {
      const out: HomepageSectionItem = {
        id: d.id,
        title: d.title,
        sortOrder: idx,
        active: d.active ? 1 : 0,
      };
      if (d.description) out.description = d.description;
      if (d.categoryId) out.categoryId = d.categoryId;
      if (d.serviceTypeId) out.serviceTypeId = d.serviceTypeId;
      if (d.thumbnail) out.thumbnail = d.thumbnail;
      if (d.videoUrl) out.videoUrl = d.videoUrl;
      if (d.externalUrl) out.externalUrl = d.externalUrl;
      if (d.durationSeconds) out.durationSeconds = Number(d.durationSeconds);
      return out;
    });
    onSave(items);
    setDirty(false);
  }

  return (
    <div className="mt-4 space-y-3">
      {drafts.map((d, i) => (
        <div key={d.id} className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
          <div className="flex items-center justify-between sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Card {i + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Move up">
                <Icon name="chevron-left" className="h-3.5 w-3.5 rotate-90" />
              </button>
              <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={i === drafts.length - 1} onClick={() => reorder(i, 1)} aria-label="Move down">
                <Icon name="chevron-right" className="h-3.5 w-3.5 rotate-90" />
              </button>
              <label className="flex items-center gap-1 px-1 text-xs text-neutral-700">
                <input type="checkbox" checked={d.active} onChange={(e) => update(i, { active: e.target.checked })} />
                Active
              </label>
              <button type="button" className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" onClick={() => remove(i)} aria-label="Remove">
                <Icon name="trash" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className={labelClasses}>Title</label>
            <input className={inputClasses} value={d.title} onChange={(e) => update(i, { title: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses}>Duration (seconds, optional)</label>
            <input className={inputClasses} type="number" value={d.durationSeconds} onChange={(e) => update(i, { durationSeconds: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClasses}>Description (optional)</label>
            <input className={inputClasses} value={d.description} onChange={(e) => update(i, { description: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses}>Category key (optional, from the Catalog tab's slugs)</label>
            <input className={inputClasses} value={d.categoryId} onChange={(e) => update(i, { categoryId: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses}>Service type key (optional)</label>
            <input className={inputClasses} value={d.serviceTypeId} onChange={(e) => update(i, { serviceTypeId: e.target.value })} />
          </div>
          <MediaPickerField label="Thumbnail image" accept="image" value={d.thumbnail} onChange={(url) => update(i, { thumbnail: url })} />
          <MediaPickerField
            label="Video file (optional — leave empty to show 'Video coming soon')"
            accept="video"
            value={d.videoUrl}
            onChange={(url) => update(i, { videoUrl: url })}
          />
          <div className="sm:col-span-2">
            <label className={labelClasses}>Or an external video link (optional, used if no file is uploaded)</label>
            <input className={inputClasses} value={d.externalUrl} onChange={(e) => update(i, { externalUrl: e.target.value })} placeholder="https://…" />
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="md" onClick={add}>
          Add video card
        </Button>
        <Button type="button" size="md" disabled={saving || !dirty} onClick={handleSave}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

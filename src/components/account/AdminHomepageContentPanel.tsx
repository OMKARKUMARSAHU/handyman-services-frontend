"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import { MediaPickerField } from "@/components/account/MediaPicker";
import { resolveVideoEmbed } from "@/lib/video/embed";
import {
  buildVideoSavePayload,
  countPlayableVideos,
  toVideoDraftList,
  type VideoClipDraft,
  type VideoCurationDraft,
} from "@/lib/admin/videoShowcaseDraft";
import {
  AuthApiError,
  listHomepageSectionsAdmin,
  createHomepageSection,
  updateHomepageSection,
  getBrandingAdmin,
  updateBranding,
  getContactInfoAdmin,
  updateContactInfo,
  type AdminHomepageSection,
  type HomepageSectionItem,
  type AdminBranding,
  type AdminContactInfo,
  type SocialLink,
} from "@/lib/admin/content-api";
import {
  listOffersAdmin,
  createOffer,
  updateOffer,
  listCitiesAdmin,
  type AdminOffer,
  type AdminCity,
  type OfferInput,
  type OfferApplicabilityType,
  type OfferScope,
  type OfferDiscountType,
} from "@/lib/admin/catalog-api";
import { DirtyRegistryProvider, useBeforeUnloadGuard, useDraftSave } from "@/lib/admin/useDraftSave";

/**
 * Admin Homepage Content — HOMEPAGE ADMIN REBUILD (full rebuild of the
 * previous, two-section version: Trust Strip + Video Curations only).
 *
 * This panel now follows the real customer-facing homepage top to bottom
 * (see app/page.tsx's own section-order doc comment, which this mirrors
 * exactly): Header/Branding → Hero text → Hero image gallery → Trust
 * strip → Promotional offer banners → New & Noteworthy/Featured/
 * Category rails (Catalog-managed, explained here) → Browse by Category
 * (Catalog-managed, explained here) → Real service visits on video →
 * How It Works → Footer/Contact info. Every section is numbered and
 * labeled with exactly where it appears live, per the brief's "a client
 * who does not know the database structure... must understand this."
 *
 * STAGED DRAFTS (Step 5, CRITICAL): every editable section below is built
 * on `useDraftSave` (`@/lib/admin/useDraftSave`) — nothing typed, picked,
 * reordered or removed reaches the live homepage until that section's own
 * "Save changes" is clicked and the server confirms it; "Cancel" discards
 * back to whatever was last actually saved. Picking a photo/video still
 * calls the existing Media Library upload flow immediately (it always
 * has — that's how every media field in this project already works), but
 * that only creates a reusable Library asset; it does not, by itself,
 * touch `homepage_sections`/`branding`/`contact_info` — see
 * `useDraftSave.ts`'s own doc comment for the full rationale.
 *
 * SECTIONS DELIBERATELY NOT DUPLICATED HERE: Browse by Category, New &
 * Noteworthy, Featured Services, and the category-wise rails are driven
 * by the Category/Service entities already fully editable in the Catalog
 * tab (image, Featured/Most-booked checkboxes, Display order — see
 * claude/phase-8-admin-cms-content-pipeline-audit.md). Building a second,
 * parallel editor for the same rows here would risk the two drifting out
 * of sync and violates the explicit "do not modify/redesign/break the
 * Catalog section" instruction — so those sections get an explanatory
 * card with a direct link to Catalog instead of a duplicate CRUD surface.
 */

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1 block text-xs font-medium text-neutral-700";

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tmp-${Date.now()}-${Math.random()}`;
}

// ---------------------------------------------------------------------
// Shared section shell — order badge, location blurb, saved/pending
// status, Save/Cancel.
// ---------------------------------------------------------------------

function StatusPill({ status, dirty }: { status: "idle" | "dirty" | "saving" | "saved" | "error"; dirty: boolean }) {
  if (status === "saving") {
    return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Saving…</span>;
  }
  if (status === "error") {
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Save failed</span>;
  }
  if (dirty) {
    return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">Pending changes</span>;
  }
  if (status === "saved") {
    return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Saved</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">No unsaved changes</span>;
}

function SectionShell({
  order,
  title,
  whereItAppears,
  dirty,
  status,
  error,
  onSave,
  onCancel,
  saveDisabled,
  children,
}: {
  order: number;
  title: string;
  whereItAppears: string;
  dirty: boolean;
  status: "idle" | "dirty" | "saving" | "saved" | "error";
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
            {order}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-neutral-900">{title}</h2>
            <p className="truncate text-xs text-neutral-500">{whereItAppears}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={status} dirty={dirty} />
          <Icon name={expanded ? "chevron-left" : "chevron-right"} className={`h-4 w-4 text-neutral-400 ${expanded ? "-rotate-90" : "rotate-90"}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-neutral-100 px-6 py-5">
          {children}

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center gap-2 border-t border-neutral-100 pt-4">
            <Button type="button" size="md" disabled={!dirty || status === "saving" || saveDisabled} onClick={onSave}>
              {status === "saving" ? "Saving…" : "Done / Save changes"}
            </Button>
            <Button type="button" variant="outline" size="md" disabled={!dirty || status === "saving"} onClick={onCancel}>
              Cancel
            </Button>
            {!dirty && status !== "saving" && (
              <span className="text-xs text-neutral-400">Nothing will reach the live site until you click Save.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoShell({ order, title, whereItAppears, children }: { order: number; title: string; whereItAppears: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-400 text-xs font-bold text-white">{order}</span>
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          <p className="text-xs text-neutral-500">{whereItAppears}</p>
        </div>
      </div>
      <div className="mt-3 text-sm text-neutral-600">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------

export function AdminHomepageContentPanel({ onNavigateToCatalog }: { onNavigateToCatalog?: () => void }) {
  const [sections, setSections] = useState<AdminHomepageSection[] | null>(null);
  const [branding, setBranding] = useState<AdminBranding | null>(null);
  const [contactInfo, setContactInfo] = useState<AdminContactInfo | null>(null);
  const [offers, setOffers] = useState<AdminOffer[] | null>(null);
  const [cities, setCities] = useState<AdminCity[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirtyLabels, setDirtyLabels] = useState<string[]>([]);

  // Stable identity + no-op when nothing changed (see useDraftSave.tsx /
  // dirtyTracker.ts) -- an inline callback here re-registered every section
  // on every render and looped ("Maximum update depth exceeded").
  const handleDirtyChange = useCallback((_anyDirty: boolean, labels: string[]) => {
    setDirtyLabels((prev) => (prev.length === labels.length && prev.every((l, i) => l === labels[i]) ? prev : labels));
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [sectionsResult, brandingResult, contactResult, offersResult, citiesResult] = await Promise.all([
        listHomepageSectionsAdmin(),
        getBrandingAdmin().catch(() => ({ logoUrl: null, logoAlt: null, brandAssets: [] }) as AdminBranding),
        getContactInfoAdmin().catch(() => null),
        listOffersAdmin().catch(() => [] as AdminOffer[]),
        listCitiesAdmin().catch(() => [] as AdminCity[]),
      ]);
      setSections(sectionsResult);
      setBranding(brandingResult);
      setContactInfo(contactResult);
      setOffers(offersResult);
      setCities(citiesResult);
    } catch (err) {
      setLoadError(err instanceof AuthApiError ? err.message : "Could not load homepage content.");
      setSections([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const anyDirty = dirtyLabels.length > 0;
  useBeforeUnloadGuard(anyDirty);

  /** Generic create-or-update for the simple one-row-per-key `homepage_sections` sections (hero, howItWorks, whyChooseUs, video-curations, …). Mirrors the original panel's "create on first save" behavior so a fresh/never-seeded database still works. */
  const saveSection = useCallback(
    async (key: string, defaultHeading: string, patch: Partial<Omit<AdminHomepageSection, "key">>) => {
      const existing = sections?.find((s) => s.key === key);
      if (existing) {
        await updateHomepageSection(key, patch);
      } else {
        await createHomepageSection({ key, heading: patch.heading ?? defaultHeading, ...patch });
      }
      await load();
    },
    [sections, load]
  );

  if (sections === null && !loadError) {
    return <p className="text-sm text-neutral-500">Loading homepage content…</p>;
  }

  const heroSection = sections?.find((s) => s.key === "hero") ?? null;
  const whyChooseUs = sections?.find((s) => s.key === "whyChooseUs") ?? null;
  const videoCurations = sections?.find((s) => s.key === "video-curations") ?? null;
  const howItWorks = sections?.find((s) => s.key === "howItWorks") ?? null;

  return (
    <DirtyRegistryProvider onChange={handleDirtyChange}>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Homepage Content</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every section below follows the live homepage in order, top to bottom. Each one explains exactly where it
            shows up on the site. Nothing you type, upload, or reorder reaches the live homepage until you click that
            section&rsquo;s own &ldquo;Done / Save changes&rdquo; button — &ldquo;Cancel&rdquo; discards your edits and
            restores whatever is currently live.
          </p>
        </div>

        {anyDirty && (
          <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            <Icon name="shield-check" className="h-4 w-4 shrink-0" />
            <span>
              Unsaved changes in: <strong>{dirtyLabels.join(", ")}</strong>. Save or cancel each one before leaving this tab.
            </span>
          </div>
        )}

        {loadError && <p className="text-sm font-medium text-red-600">{loadError}</p>}

        {sections && sections.length >= 0 && (
          <>
            <BrandingSection order={1} branding={branding} onSaved={load} />

            <HeroTextSection order={2} section={heroSection} onSave={saveSection} />

            <HeroImagesSection order={3} section={heroSection} onSave={saveSection} />

            <TrustStripSection order={4} section={whyChooseUs} onSave={saveSection} />

            <PromotionalBannersSection order={5} offers={offers} cities={cities} onReload={load} />

            <InfoShell
              order={6}
              title="New & Noteworthy / Featured Services / Category-wise rails"
              whereItAppears="Homepage — the horizontal service rails between the first and second promotional banners (and on each city page)."
            >
              <p>
                These rails are populated automatically from your <strong>Services</strong>, using the{" "}
                <strong>Featured</strong> checkbox (New &amp; Noteworthy), the <strong>Most booked</strong> checkbox
                (Featured Services rail), and each service&rsquo;s <strong>category</strong> and{" "}
                <strong>Display order</strong> field for the category-wise rails beneath them.
              </p>
              <p className="mt-2">
                Manage which services appear, and in what order, from <strong>Catalog → Services</strong> — edited
                there so this stays the exact same data the rest of the catalog uses, with nothing to keep in sync.
              </p>
              {onNavigateToCatalog && (
                <Button type="button" size="md" variant="outline" className="mt-3" onClick={onNavigateToCatalog}>
                  Go to Catalog → Services
                </Button>
              )}
            </InfoShell>

            <InfoShell
              order={7}
              title="Browse by Category"
              whereItAppears="Homepage — the category grid below the service rails ('What do you need serviced?')."
            >
              <p>
                This grid shows every active <strong>Category</strong> — its name, description, and image. Manage
                categories (including each one&rsquo;s photo and display order) from{" "}
                <strong>Catalog → Categories</strong>.
              </p>
              {onNavigateToCatalog && (
                <Button type="button" size="md" variant="outline" className="mt-3" onClick={onNavigateToCatalog}>
                  Go to Catalog → Categories
                </Button>
              )}
            </InfoShell>

            <VideoCurationsSection order={8} section={videoCurations} onSave={saveSection} />

            <HowItWorksSection order={9} section={howItWorks} onSave={saveSection} />

            <ContactInfoSection order={10} contactInfo={contactInfo} onSaved={load} />
          </>
        )}
      </div>
    </DirtyRegistryProvider>
  );
}

// ---------------------------------------------------------------------
// 1. Branding (Header + Footer logo)
// ---------------------------------------------------------------------

function BrandingSection({ order, branding, onSaved }: { order: number; branding: AdminBranding | null; onSaved: () => Promise<void> }) {
  const serverValue = { logoUrl: branding?.logoUrl ?? null, logoAlt: branding?.logoAlt ?? "" };
  const { draft, setDraft, dirty, status, error, save, cancel } = useDraftSave(
    "branding",
    "Header & branding",
    serverValue,
    async (d) => {
      await updateBranding({ logoUrl: d.logoUrl, logoAlt: d.logoAlt || null });
      await onSaved();
    }
  );

  return (
    <SectionShell
      order={order}
      title="Header & branding (logo)"
      whereItAppears="The logo badge in the site header (every page) and the full logo in the site footer."
      dirty={dirty}
      status={status}
      error={error}
      onSave={() => void save()}
      onCancel={cancel}
    >
      <p className="mb-3 text-xs text-neutral-500">
        Leave this empty to keep the site&rsquo;s current default logo — nothing here is required.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MediaPickerField label="Logo image" accept="image" value={draft.logoUrl} onChange={(url) => setDraft((d) => ({ ...d, logoUrl: url }))} />
        <div>
          <label className={labelClasses}>Logo alt text (optional)</label>
          <input
            className={inputClasses}
            value={draft.logoAlt}
            onChange={(e) => setDraft((d) => ({ ...d, logoAlt: e.target.value }))}
            placeholder="Handyman Services"
          />
        </div>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------
// 2. Hero text
// ---------------------------------------------------------------------

type SaveSectionFn = (key: string, defaultHeading: string, patch: Partial<Omit<AdminHomepageSection, "key">>) => Promise<void>;

function HeroTextSection({ order, section, onSave }: { order: number; section: AdminHomepageSection | null; onSave: SaveSectionFn }) {
  const serverValue = { heading: section?.heading ?? "Find trusted help for every home appliance", subheading: section?.subheading ?? "" };
  const { draft, setDraft, dirty, status, error, save, cancel } = useDraftSave("hero-text", "Hero heading", serverValue, async (d) => {
    await onSave("hero", "Find trusted help for every home appliance", { heading: d.heading, subheading: d.subheading || null });
  });

  return (
    <SectionShell
      order={order}
      title="Hero section — heading & text"
      whereItAppears="Homepage — the large heading at the very top, next to the 'What do you need serviced?' discovery panel."
      dirty={dirty}
      status={status}
      error={error}
      onSave={() => void save()}
      onCancel={cancel}
      saveDisabled={draft.heading.trim().length === 0}
    >
      <div className="space-y-3">
        <div>
          <label className={labelClasses}>Main heading</label>
          <input className={inputClasses} value={draft.heading} onChange={(e) => setDraft((d) => ({ ...d, heading: e.target.value }))} />
        </div>
        <div>
          <label className={labelClasses}>Supporting text (optional)</label>
          <textarea
            className={inputClasses}
            rows={2}
            value={draft.subheading}
            onChange={(e) => setDraft((d) => ({ ...d, subheading: e.target.value }))}
          />
        </div>
        <p className="text-xs text-neutral-500">
          This heading/text is used on the city-agnostic homepage (&ldquo;/&rdquo;). On a city page (e.g.
          &ldquo;/mumbai&rdquo;), the heading always shows &ldquo;Home services in &lt;city&gt;&rdquo; instead, so
          every city keeps its own name in the heading.
        </p>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------
// 3. Hero image gallery
// ---------------------------------------------------------------------

interface HeroImageDraft {
  id: string;
  url: string;
  alt: string;
}

function toHeroImageDrafts(items: HomepageSectionItem[] | null | undefined): HeroImageDraft[] {
  if (!items) return [];
  return items
    .filter((it) => typeof it.url === "string" || typeof it.url === "number")
    .map((it, i) => ({ id: String(it.id ?? `slot-${i}`), url: String(it.url ?? ""), alt: it.alt != null ? String(it.alt) : "" }));
}

function HeroImagesSection({ order, section, onSave }: { order: number; section: AdminHomepageSection | null; onSave: SaveSectionFn }) {
  const serverValue = toHeroImageDrafts(section?.items);
  const { draft, setDraft, dirty, status, error, save, cancel } = useDraftSave(
    "hero-images",
    "Hero image gallery",
    serverValue,
    async (d) => {
      const items: HomepageSectionItem[] = d.map((img, i) => ({ id: img.id, slot: String(i), url: img.url, alt: img.alt }));
      await onSave("hero", "Find trusted help for every home appliance", { items });
    }
  );

  function add() {
    setDraft((prev) => [...prev, { id: newId(), url: "", alt: "" }]);
  }
  function update(i: number, patch: Partial<HeroImageDraft>) {
    setDraft((prev) => prev.map((img, idx) => (idx === i ? { ...img, ...patch } : img)));
  }
  function remove(i: number) {
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
  }
  function reorder(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= draft.length) return;
    setDraft((prev) => move(prev, i, j));
  }

  return (
    <SectionShell
      order={order}
      title="Hero image gallery"
      whereItAppears="Homepage — the photo collage next to (desktop) or below (mobile) the hero heading."
      dirty={dirty}
      status={status}
      error={error}
      onSave={() => void save()}
      onCancel={cancel}
    >
      <p className="mb-3 text-xs text-neutral-500">
        With no images added here, the site shows its original default photos — add one or more below to replace
        them. If you add fewer than 4, the same images repeat to fill every slot; reorder them to change which image
        lands in which position.
      </p>
      <div className="space-y-3">
        {draft.map((img, i) => (
          <div key={img.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <span className="text-xs font-semibold text-neutral-500">#{i + 1}</span>
            <MediaPickerField label="Image" accept="image" value={img.url || null} onChange={(url) => update(i, { url: url ?? "" })} />
            <div className="min-w-[160px]">
              <label className={labelClasses}>Alt text (optional)</label>
              <input className={inputClasses} value={img.alt} onChange={(e) => update(i, { alt: e.target.value })} />
            </div>
            <div className="ml-auto flex items-center gap-1 self-start">
              <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Move up">
                <Icon name="chevron-left" className="h-3.5 w-3.5 rotate-90" />
              </button>
              <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={i === draft.length - 1} onClick={() => reorder(i, 1)} aria-label="Move down">
                <Icon name="chevron-right" className="h-3.5 w-3.5 rotate-90" />
              </button>
              <button type="button" className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" onClick={() => remove(i)} aria-label="Remove">
                <Icon name="trash" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="md" onClick={add}>
          Add image
        </Button>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------
// 4. Trust / service benefit strip
// ---------------------------------------------------------------------

interface TrustStripDraft {
  id: string;
  icon: string;
  title: string;
  description: string;
  active: boolean;
}

function toTrustDrafts(items: HomepageSectionItem[] | null | undefined): TrustStripDraft[] {
  if (!items) return [];
  return items.map((it, i) => ({
    id: String(it.id ?? `trust-${i}`),
    icon: String(it.icon ?? "shield-check"),
    title: String(it.title ?? ""),
    description: String(it.description ?? ""),
    active: it.active === undefined || Number(it.active) === 1,
  }));
}

function TrustStripSection({ order, section, onSave }: { order: number; section: AdminHomepageSection | null; onSave: SaveSectionFn }) {
  const serverValue = toTrustDrafts(section?.items);
  const { draft, setDraft, dirty, status, error, save, cancel } = useDraftSave(
    "whyChooseUs",
    "Trust / benefit strip",
    serverValue,
    async (d) => {
      const items: HomepageSectionItem[] = d.map((item) => ({
        icon: item.icon,
        title: item.title,
        description: item.description,
        active: item.active ? 1 : 0,
      }));
      await onSave("whyChooseUs", "Why Choose Handyman Services", { items });
    }
  );

  function add() {
    setDraft((prev) => [...prev, { id: newId(), icon: "shield-check", title: "", description: "", active: true }]);
  }
  function update(i: number, patch: Partial<TrustStripDraft>) {
    setDraft((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function remove(i: number) {
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
  }
  function reorder(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= draft.length) return;
    setDraft((prev) => move(prev, i, j));
  }

  return (
    <SectionShell
      order={order}
      title="Trust / service benefit strip"
      whereItAppears="Homepage — the compact row directly under the hero ('Dedicated Technician Visits', 'No Hidden Charges', …)."
      dirty={dirty}
      status={status}
      error={error}
      onSave={() => void save()}
      onCancel={cancel}
    >
      <div className="space-y-3">
        {draft.map((d, i) => (
          <div key={d.id} className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
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
              <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={i === draft.length - 1} onClick={() => reorder(i, 1)} aria-label="Move down">
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
        <Button type="button" variant="outline" size="md" onClick={add}>
          Add item
        </Button>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------
// 5. Promotional offer banners (reuses the existing Offers API — the same
// data Catalog → Offers manages — so the large banners, the second large
// banner, and the small "Spotlight" cards all stay driven by one source).
// ---------------------------------------------------------------------

const DISCOUNT_TYPES: OfferDiscountType[] = ["percent", "flat"];
const OFFER_SCOPES: OfferScope[] = ["all", "category", "service"];
const APPLICABILITY_TYPES: OfferApplicabilityType[] = ["all_india", "city"];

function offerToInput(o: AdminOffer): OfferInput {
  return {
    title: o.title,
    description: o.description,
    discountType: o.discountType,
    discountValue: o.discountValue,
    applicabilityType: o.applicabilityType,
    cityId: o.cityId,
    appliesTo: o.appliesTo,
    bannerImage: o.bannerImage,
    startDate: o.startDate,
    endDate: o.endDate,
    active: o.active,
  };
}

const EMPTY_OFFER: OfferInput = {
  title: "",
  description: "",
  discountType: "percent",
  discountValue: 0,
  applicabilityType: "all_india",
  cityId: null,
  appliesTo: { scope: "all", ids: [] },
  bannerImage: null,
  startDate: null,
  endDate: null,
  active: true,
};

function OfferFields({
  draft,
  setDraft,
  cities,
}: {
  draft: OfferInput;
  setDraft: (next: OfferInput | ((p: OfferInput) => OfferInput)) => void;
  cities: AdminCity[] | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={labelClasses}>Title</label>
        <input className={inputClasses} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
      </div>
      <div>
        <label className={labelClasses}>Discount</label>
        <div className="flex gap-2">
          <select
            className={inputClasses}
            value={draft.discountType}
            onChange={(e) => setDraft((d) => ({ ...d, discountType: e.target.value as OfferDiscountType }))}
          >
            {DISCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "percent" ? "% off" : "₹ off"}
              </option>
            ))}
          </select>
          <input
            type="number"
            className={inputClasses}
            value={draft.discountValue}
            onChange={(e) => setDraft((d) => ({ ...d, discountValue: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className={labelClasses}>Description / subtitle</label>
        <textarea className={inputClasses} rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
      </div>
      <div>
        <label className={labelClasses}>Applies to</label>
        <select
          className={inputClasses}
          value={draft.appliesTo.scope}
          onChange={(e) => setDraft((d) => ({ ...d, appliesTo: { scope: e.target.value as OfferScope, ids: d.appliesTo.ids } }))}
        >
          {OFFER_SCOPES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All services" : s === "category" ? "One category" : "One service"}
            </option>
          ))}
        </select>
      </div>
      {draft.appliesTo.scope !== "all" && (
        <div>
          <label className={labelClasses}>{draft.appliesTo.scope === "category" ? "Category ID" : "Service ID"} (from Catalog)</label>
          <input
            className={inputClasses}
            value={draft.appliesTo.ids[0] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, appliesTo: { scope: d.appliesTo.scope, ids: e.target.value ? [e.target.value] : [] } }))}
          />
        </div>
      )}
      <div>
        <label className={labelClasses}>Where this offer applies</label>
        <select
          className={inputClasses}
          value={draft.applicabilityType}
          onChange={(e) =>
            setDraft((d) => ({ ...d, applicabilityType: e.target.value as OfferApplicabilityType, cityId: e.target.value === "all_india" ? null : d.cityId }))
          }
        >
          {APPLICABILITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "all_india" ? "All India" : "One city"}
            </option>
          ))}
        </select>
      </div>
      {draft.applicabilityType === "city" && (
        <div>
          <label className={labelClasses}>City</label>
          <select className={inputClasses} value={draft.cityId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, cityId: e.target.value || null }))}>
            <option value="">Select a city…</option>
            {(cities ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <MediaPickerField label="Banner image" accept="image" value={draft.bannerImage ?? null} onChange={(url) => setDraft((d) => ({ ...d, bannerImage: url }))} />
      <div>
        <label className={labelClasses}>Start date (optional)</label>
        <input type="date" className={inputClasses} value={draft.startDate ?? ""} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value || null }))} />
      </div>
      <div>
        <label className={labelClasses}>End date (optional)</label>
        <input type="date" className={inputClasses} value={draft.endDate ?? ""} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value || null }))} />
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={draft.active ?? true} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
          Active (visible on the live site)
        </label>
      </div>
    </div>
  );
}

function OfferRow({ offer, cities, onReload }: { offer: AdminOffer; cities: AdminCity[] | null; onReload: () => Promise<void> }) {
  const serverValue = offerToInput(offer);
  const { draft, setDraft, dirty, status, error, save, cancel } = useDraftSave(
    `offer-${offer.id}`,
    `Offer: ${offer.title || "(untitled)"}`,
    serverValue,
    async (d) => {
      await updateOffer(offer.id, d);
      await onReload();
    }
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-800">{offer.title || "(untitled offer)"}</span>
        <StatusPill status={status} dirty={dirty} />
      </div>
      <OfferFields draft={draft} setDraft={setDraft} cities={cities} />
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button type="button" size="md" disabled={!dirty || status === "saving"} onClick={() => void save()}>
          {status === "saving" ? "Saving…" : "Save this offer"}
        </Button>
        <Button type="button" variant="outline" size="md" disabled={!dirty || status === "saving"} onClick={cancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function NewOfferForm({ cities, onReload }: { cities: AdminCity[] | null; onReload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const { draft, setDraft, dirty, status, error, save, cancel } = useDraftSave("offer-new", "New offer (not yet created)", EMPTY_OFFER, async (d) => {
    await createOffer(d);
    await onReload();
    setOpen(false);
  });

  if (!open) {
    return (
      <Button type="button" variant="outline" size="md" onClick={() => setOpen(true)}>
        + Add a new offer banner
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-800">New offer</span>
        <StatusPill status={status} dirty={dirty} />
      </div>
      <OfferFields draft={draft} setDraft={setDraft} cities={cities} />
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button type="button" size="md" disabled={!draft.title || status === "saving"} onClick={() => void save()}>
          {status === "saving" ? "Creating…" : "Create offer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={status === "saving"}
          onClick={() => {
            cancel();
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PromotionalBannersSection({
  order,
  offers,
  cities,
  onReload,
}: {
  order: number;
  offers: AdminOffer[] | null;
  cities: AdminCity[] | null;
  onReload: () => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">{order}</span>
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Promotional offer banners</h2>
          <p className="text-xs text-neutral-500">
            Homepage — the two large rotating banners (one above, one below the service rails) and the small
            &ldquo;Spotlight&rdquo; offer cards further down. All three read from the same offers below.
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-neutral-600">
        Each offer below becomes one slide in both large banners (title, subtitle, discount badge, and banner image)
        and one small Spotlight card. New offers appear first; there is no separate manual reorder for banners —
        they always show newest-first. Each offer has its own Save/Cancel, independent of the others.
      </p>

      <div className="mt-4 space-y-3">
        {offers === null && <p className="text-sm text-neutral-500">Loading…</p>}
        {offers !== null && offers.length === 0 && <p className="text-sm text-neutral-500">No offers yet.</p>}
        {offers?.map((o) => <OfferRow key={o.id} offer={o} cities={cities} onReload={onReload} />)}
        <NewOfferForm cities={cities} onReload={onReload} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// 8. Real service visits on video — multi-clip Video Showcase
// ---------------------------------------------------------------------

/** True once the card has a main video (uploaded file or non-empty link) -- i.e. position 1 of its playlist is taken. */
function cleanUrlForUi(videoUrl: string | null, externalUrl: string): boolean {
  return Boolean(videoUrl) || externalUrl.trim().length > 0;
}

function blankClipDraft(): VideoClipDraft {
  return { id: newId(), title: "", videoUrl: null, externalUrl: "", thumbnail: null, durationSeconds: "" };
}

/** A clip "has a video" once either an uploaded file or a non-empty external link is set — the one thing Done requires before it will commit a clip. */
function clipHasVideo(clip: VideoClipDraft): boolean {
  return Boolean(clip.videoUrl) || clip.externalUrl.trim().length > 0;
}

/**
 * Shared status + live preview for one "video" field (a card's main
 * video, or one clip) — used by both `VideoCard` and `ClipEditor` so a
 * main video and a clip get the exact same behavior. Requirement:
 * "the admin must be able to identify exactly which video belongs to
 * which card" and "a clear indication of whether the video is an
 * uploaded file or an external URL" and "a video preview and playback
 * test before saving."
 *
 * An uploaded file always wins over an external link (same precedence
 * the save payload and the public modal both use). For an external
 * link, this runs it through the same `resolveVideoEmbed` the public
 * homepage uses — so what the admin sees here previewing is exactly
 * what a visitor will see, not just a raw URL the admin has to trust.
 */
function VideoFieldPreview({ videoUrl, externalUrl }: { videoUrl: string | null; externalUrl: string }) {
  const trimmedExternal = externalUrl.trim();
  const embed = !videoUrl && trimmedExternal ? resolveVideoEmbed(trimmedExternal) : null;
  const invalid = !videoUrl && trimmedExternal.length > 0 && embed === null;

  const statusLabel = videoUrl
    ? "Uploaded video"
    : embed?.kind === "youtube"
      ? "External link — YouTube"
      : embed?.kind === "file"
        ? "External link — direct video file"
        : embed
          ? "External link"
          : invalid
            ? "External link — doesn't look like a valid video URL"
            : "No video set — shows \"Video coming soon\" on the homepage";

  return (
    <div className="mt-3">
      <p className={labelClasses}>
        Status: <span className={`font-semibold ${invalid ? "text-red-600" : "text-neutral-700"}`}>{statusLabel}</span>
      </p>
      {videoUrl ? (
        <video src={videoUrl} controls className="mt-1 h-40 rounded-lg bg-black" />
      ) : embed?.kind === "file" ? (
        <video src={embed.embedUrl} controls className="mt-1 h-40 rounded-lg bg-black" />
      ) : embed ? (
        <div className="mt-1">
          <iframe
            src={embed.embedUrl}
            className="h-40 w-full max-w-xs rounded-lg bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-brand-700 underline">
            Can&rsquo;t see it embedded? Open directly ↗
          </a>
        </div>
      ) : invalid ? (
        <p className="mt-1 text-xs font-medium text-red-600">
          That doesn&rsquo;t look like a playable video link — it needs to be a full http:// or https:// URL (a YouTube link, or a direct
          .mp4/.webm/.mov link).
        </p>
      ) : null}
    </div>
  );
}

function VideoCurationsSection({ order, section, onSave }: { order: number; section: AdminHomepageSection | null; onSave: SaveSectionFn }) {
  const serverValue = useMemo(() => toVideoDraftList(section?.items), [section?.items]);
  const { draft, setDraft, dirty, status, error, save, cancel } = useDraftSave(
    "video-curations",
    "Real service visits, on video",
    serverValue,
    async (d) => {
      const items = buildVideoSavePayload(d);
      await onSave("video-curations", "Real service visits, on video", { items });
    }
  );

  function addCard() {
    setDraft((prev) => [
      ...prev,
      {
        id: newId(),
        title: "",
        description: "",
        categoryId: "",
        serviceTypeId: "",
        thumbnail: null,
        videoUrl: null,
        externalUrl: "",
        durationSeconds: "",
        active: true,
        markedForDeletion: false,
        clips: [],
      },
    ]);
  }
  function updateCard(i: number, patch: Partial<VideoCurationDraft>) {
    setDraft((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function reorderCard(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= draft.length) return;
    setDraft((prev) => move(prev, i, j));
  }
  function setCardClips(i: number, clips: VideoClipDraft[]) {
    updateCard(i, { clips });
  }

  const cardsMarkedForDeletion = draft.filter((c) => c.markedForDeletion);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function runSave() {
    try {
      await save();
    } catch {
      // `save()` already put the real failure message in `error` and left the
      // draft (including any card flagged for deletion) untouched -- nothing
      // more to do, but the rejection must not escape as an unhandled one.
    }
  }
  function requestSave() {
    // Deleting is the one destructive thing this section can do, so it gets
    // an explicit confirmation *at save time*, right before it becomes permanent.
    if (cardsMarkedForDeletion.length > 0) setConfirmingDelete(true);
    else void runSave();
  }

  return (
    <SectionShell
      order={order}
      title="Real service visits, on video (Video Showcase)"
      whereItAppears="Homepage — the dark 'See It In Action' section, between the second promotional banner and the Spotlight offer cards."
      dirty={dirty}
      status={status}
      error={error}
      onSave={requestSave}
      onCancel={cancel}
    >
      <p className="mb-4 text-xs text-neutral-500">
        Each card below is one showcase item on the live site. A card with no video uploaded shows &ldquo;Video
        coming soon&rdquo; instead of breaking the layout — nothing fake is ever shown in its place. A card can hold
        a main video plus extra videos in its own playlist (add them under &ldquo;Playlist for this card&rdquo;) —
        visitors step through that card&rsquo;s videos with Previous / Next in a single player. To hide a card from the live homepage but keep
        it here, uncheck &ldquo;Active&rdquo;. To remove a card for good (together with all of its additional clips),
        click &ldquo;Delete&rdquo; on it and then &ldquo;Done / Save changes&rdquo; — nothing is deleted until you save and confirm.
      </p>
      <div className="space-y-4">
        {draft.map((card, i) => (
          <VideoCard
            key={card.id}
            card={card}
            isFirst={i === 0}
            isLast={i === draft.length - 1}
            onUpdateCard={(patch) => updateCard(i, patch)}
            onReorderCard={(delta) => reorderCard(i, delta)}
            onSetClips={(clips) => setCardClips(i, clips)}
            onDelete={() => updateCard(i, { markedForDeletion: true })}
            onUndoDelete={() => updateCard(i, { markedForDeletion: false })}
          />
        ))}
        <Button type="button" variant="outline" size="md" onClick={addCard}>
          Add video card
        </Button>
      </div>
      {confirmingDelete && (
        <ConfirmDeleteCardsDialog
          titles={cardsMarkedForDeletion.map((c) => c.title || "Untitled card")}
          clipCount={cardsMarkedForDeletion.reduce((n, c) => n + c.clips.length, 0)}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            void runSave();
          }}
        />
      )}
    </SectionShell>
  );
}

/**
 * Save-time confirmation for permanently removing Video Showcase cards.
 * Plain in-page dialog (not window.confirm) so it is keyboard accessible,
 * styled like the rest of the panel, and does not block the page.
 */
function ConfirmDeleteCardsDialog({
  titles,
  clipCount,
  onCancel,
  onConfirm,
}: {
  titles: string[];
  clipCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-video-cards-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 id="confirm-delete-video-cards-title" className="text-base font-semibold text-neutral-900">
          Permanently delete {titles.length === 1 ? "this video card" : `these ${titles.length} video cards`}?
        </h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {titles.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-neutral-600">
          {clipCount > 0
            ? `This also removes the ${clipCount} additional clip${clipCount === 1 ? " that belongs" : "s that belong"} to ${titles.length === 1 ? "it" : "them"}. `
            : ""}
          They will disappear from the live homepage and cannot be restored afterwards. Your other changes in this section are saved at the same time.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="md" onClick={onCancel}>
            Keep editing
          </Button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            onClick={onConfirm}
            autoFocus
          >
            Delete and save
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One Video Showcase card. Owns the "which clip is currently being
 * edited" state, which is local-only and never leaves this component
 * until Done commits it into `card.clips` (still just local draft state
 * one level up, not persisted until the section's own Save) — this is
 * what gives "Additional clips" its own Done step, distinct from the
 * section-level Save/Cancel the brief is careful not to confuse it with.
 */
function VideoCard({
  card,
  isFirst,
  isLast,
  onUpdateCard,
  onReorderCard,
  onSetClips,
  onDelete,
  onUndoDelete,
}: {
  card: VideoCurationDraft;
  isFirst: boolean;
  isLast: boolean;
  onUpdateCard: (patch: Partial<VideoCurationDraft>) => void;
  onReorderCard: (delta: number) => void;
  onSetClips: (clips: VideoClipDraft[]) => void;
  onDelete: () => void;
  onUndoDelete: () => void;
}) {
  // null = no clip editor open. index === null = adding a brand-new clip (not yet in card.clips).
  // index === a number = editing that existing, already-committed clip in place.
  const [editing, setEditing] = useState<{ index: number | null; draft: VideoClipDraft } | null>(null);
  const [clipError, setClipError] = useState<string | null>(null);

  function startAddClip() {
    setClipError(null);
    setEditing({ index: null, draft: blankClipDraft() });
  }
  function startEditClip(idx: number) {
    setClipError(null);
    setEditing({ index: idx, draft: { ...card.clips[idx] } });
  }
  function cancelClipEdit() {
    // Discards only this one clip's in-progress edits (new or existing) —
    // separate from, and much narrower than, the section's own Cancel.
    setClipError(null);
    setEditing(null);
  }
  function updateEditingDraft(patch: Partial<VideoClipDraft>) {
    setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...patch } } : prev));
    setClipError(null);
  }
  function commitClipEdit() {
    if (!editing) return;
    if (!clipHasVideo(editing.draft)) {
      setClipError("Add a video file or a video link for this clip before clicking Done.");
      return;
    }
    // An uploaded file is always trusted (it came from the Media
    // Library). A typed external link isn't — catch an unplayable one
    // here, at Done, rather than letting it silently save and only
    // break on the public homepage.
    if (!editing.draft.videoUrl && resolveVideoEmbed(editing.draft.externalUrl) === null) {
      setClipError("That video link doesn't look valid — it needs to be a full http:// or https:// URL.");
      return;
    }
    if (editing.index === null) {
      onSetClips([...card.clips, editing.draft]);
    } else {
      onSetClips(card.clips.map((c, idx) => (idx === editing.index ? editing.draft : c)));
    }
    setEditing(null);
    setClipError(null);
  }
  function removeClip(idx: number) {
    onSetClips(card.clips.filter((_, i) => i !== idx));
    if (editing?.index === idx) {
      setEditing(null);
      setClipError(null);
    }
  }
  function reorderClip(idx: number, delta: number) {
    const j = idx + delta;
    if (j < 0 || j >= card.clips.length) return;
    onSetClips(move(card.clips, idx, j));
  }

  if (card.markedForDeletion) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4" data-testid="video-card-marked-for-deletion">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-red-800">{card.title || "Untitled card"}</p>
            <p className="text-xs text-red-700">
              Marked for deletion{card.clips.length > 0 ? `, along with its ${card.clips.length} additional clip${card.clips.length === 1 ? "" : "s"}` : ""}.
              It is removed only when you click &ldquo;Done / Save changes&rdquo; and confirm; Cancel or Undo keeps it.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            onClick={onUndoDelete}
          >
            Undo delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {card.title || "Untitled card"}
          {countPlayableVideos(card) > 1 ? ` · ${countPlayableVideos(card)} videos` : ""}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={isFirst} onClick={() => onReorderCard(-1)} aria-label="Move up">
            <Icon name="chevron-left" className="h-3.5 w-3.5 rotate-90" />
          </button>
          <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={isLast} onClick={() => onReorderCard(1)} aria-label="Move down">
            <Icon name="chevron-right" className="h-3.5 w-3.5 rotate-90" />
          </button>
          <label className="flex items-center gap-1 px-1 text-xs text-neutral-700">
            <input type="checkbox" checked={card.active} onChange={(e) => onUpdateCard({ active: e.target.checked })} />
            Active
          </label>
          <button
            type="button"
            className="ml-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            onClick={onDelete}
            aria-label={`Delete card ${card.title || "Untitled card"}`}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Title</label>
          <input className={inputClasses} value={card.title} onChange={(e) => onUpdateCard({ title: e.target.value })} />
        </div>
        <div>
          <label className={labelClasses}>Duration of main video (seconds, optional)</label>
          <input type="number" className={inputClasses} value={card.durationSeconds} onChange={(e) => onUpdateCard({ durationSeconds: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Description (optional)</label>
          <input className={inputClasses} value={card.description} onChange={(e) => onUpdateCard({ description: e.target.value })} />
        </div>
        <div>
          <label className={labelClasses}>Category key (optional, from Catalog)</label>
          <input className={inputClasses} value={card.categoryId} onChange={(e) => onUpdateCard({ categoryId: e.target.value })} />
        </div>
        <div>
          <label className={labelClasses}>Service type key (optional)</label>
          <input className={inputClasses} value={card.serviceTypeId} onChange={(e) => onUpdateCard({ serviceTypeId: e.target.value })} />
        </div>
        <MediaPickerField label="Card thumbnail (poster image)" accept="image" value={card.thumbnail} onChange={(url) => onUpdateCard({ thumbnail: url })} />
        <MediaPickerField
          label="Main video (optional — leave empty to show 'Video coming soon')"
          accept="video"
          value={card.videoUrl}
          onChange={(url) => onUpdateCard({ videoUrl: url })}
        />
        <div className="sm:col-span-2">
          <label className={labelClasses}>Or an external link for the main video (used only if no file is uploaded above)</label>
          <input className={inputClasses} value={card.externalUrl} onChange={(e) => onUpdateCard({ externalUrl: e.target.value })} placeholder="https://…" />
        </div>
      </div>

      <VideoFieldPreview videoUrl={card.videoUrl} externalUrl={card.externalUrl} />

      <div className="mt-4 border-t border-neutral-200 pt-3" data-testid="card-playlist" data-card-id={card.id}>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Playlist for this card ({countPlayableVideos(card)} {countPlayableVideos(card) === 1 ? "video" : "videos"})
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Visitors watch these in one player, in the order listed here, using Previous / Next. The main video above
          always plays first; the clips below follow it. Everything on this list belongs to{" "}
          <strong>{card.title || "this card"}</strong> only &mdash; no other card can see or change it. A clip is added to this card&rsquo;s
          draft only once you click <strong>Done</strong> on it; use <strong>Save changes</strong> at the top of this
          whole section to publish.
        </p>

        {cleanUrlForUi(card.videoUrl, card.externalUrl) && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3" data-testid="playlist-row">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-white">1</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-800">Main video</p>
              <p className="truncate text-xs text-neutral-500">
                {card.videoUrl ? "Uploaded video" : "External link"} &middot; set in the Main video fields above
              </p>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {card.clips.map((clip, ci) =>
            editing?.index === ci ? (
              <ClipEditor
                key={clip.id}
                heading={`Editing clip ${ci + 1}`}
                draft={editing.draft}
                error={clipError}
                onChange={updateEditingDraft}
                onDone={commitClipEdit}
                onCancel={cancelClipEdit}
              />
            ) : (
              <div key={clip.id} data-testid="playlist-row" className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-white">
                    {ci + 1 + (cleanUrlForUi(card.videoUrl, card.externalUrl) ? 1 : 0)}
                  </span>
                  <div className="truncate">
                    <p className="truncate text-sm font-medium text-neutral-800">{clip.title || `Clip ${ci + 1}`}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {clip.videoUrl ? "Uploaded video" : clip.externalUrl ? "External link" : "No video set"}
                      {clip.durationSeconds ? ` · ${clip.durationSeconds}s` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className="rounded border border-neutral-300 p-1.5 hover:bg-neutral-100" disabled={ci === 0} onClick={() => reorderClip(ci, -1)} aria-label="Move clip up">
                    <Icon name="chevron-left" className="h-3 w-3 rotate-90" />
                  </button>
                  <button
                    type="button"
                    className="rounded border border-neutral-300 p-1.5 hover:bg-neutral-100"
                    disabled={ci === card.clips.length - 1}
                    onClick={() => reorderClip(ci, 1)}
                    aria-label="Move clip down"
                  >
                    <Icon name="chevron-right" className="h-3 w-3 rotate-90" />
                  </button>
                  <button type="button" className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100" onClick={() => startEditClip(ci)}>
                    Edit
                  </button>
                  <button type="button" className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50" onClick={() => removeClip(ci)}>
                    Remove
                  </button>
                </div>
              </div>
            )
          )}

          {editing?.index === null && (
            <ClipEditor
              heading="New clip"
              draft={editing.draft}
              error={clipError}
              onChange={updateEditingDraft}
              onDone={commitClipEdit}
              onCancel={cancelClipEdit}
            />
          )}
        </div>

        {!editing && (
          <Button type="button" variant="outline" size="md" className="mt-3" onClick={startAddClip}>
            + Add a video to this card&rsquo;s playlist
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The clip-editing step itself: upload/select a video or an external
 * link, preview it, set a thumbnail, then Done (commits into the card's
 * local `clips` draft) or Cancel (discards just this clip's edit).
 */
function ClipEditor({
  heading,
  draft,
  error,
  onChange,
  onDone,
  onCancel,
}: {
  heading: string;
  draft: VideoClipDraft;
  error: string | null;
  onChange: (patch: Partial<VideoClipDraft>) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border-2 border-brand-300 bg-brand-50/40 p-3">
      <p className="mb-2 text-xs font-semibold text-neutral-700">{heading}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Clip title (optional)</label>
          <input className={inputClasses} value={draft.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
        <div>
          <label className={labelClasses}>Clip duration (seconds, optional)</label>
          <input type="number" className={inputClasses} value={draft.durationSeconds} onChange={(e) => onChange({ durationSeconds: e.target.value })} />
        </div>
        <MediaPickerField label="Clip video" accept="video" value={draft.videoUrl} onChange={(url) => onChange({ videoUrl: url })} />
        <MediaPickerField
          label="Clip thumbnail (optional — falls back to the card thumbnail)"
          accept="image"
          value={draft.thumbnail}
          onChange={(url) => onChange({ thumbnail: url })}
        />
        <div className="sm:col-span-2">
          <label className={labelClasses}>Or an external link for this clip (used only if no file is uploaded above)</label>
          <input className={inputClasses} value={draft.externalUrl} onChange={(e) => onChange({ externalUrl: e.target.value })} placeholder="https://…" />
        </div>
      </div>
      <VideoFieldPreview videoUrl={draft.videoUrl} externalUrl={draft.externalUrl} />
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <Button type="button" variant="primary" size="md" onClick={onDone}>
          Done
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// 9. How It Works
// ---------------------------------------------------------------------

interface HowItWorksStepDraft {
  id: string;
  number: string;
  title: string;
  description: string;
}

function toStepsDrafts(items: HomepageSectionItem[] | null | undefined): HowItWorksStepDraft[] {
  if (!items) return [];
  return items.map((it, i) => ({
    id: String(it.id ?? `step-${i}`),
    number: it.number != null ? String(it.number) : String(i + 1),
    title: String(it.title ?? ""),
    description: String(it.description ?? ""),
  }));
}

function HowItWorksSection({ order, section, onSave }: { order: number; section: AdminHomepageSection | null; onSave: SaveSectionFn }) {
  const serverValue = toStepsDrafts(section?.items);
  const { draft, setDraft, dirty, status, error, save, cancel } = useDraftSave("howItWorks", "How It Works", serverValue, async (d) => {
    const items: HomepageSectionItem[] = d.map((step, i) => ({ number: step.number || String(i + 1), title: step.title, description: step.description }));
    await onSave("howItWorks", "How It Works", { items });
  });

  function add() {
    setDraft((prev) => [...prev, { id: newId(), number: String(prev.length + 1), title: "", description: "" }]);
  }
  function update(i: number, patch: Partial<HowItWorksStepDraft>) {
    setDraft((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function remove(i: number) {
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
  }
  function reorder(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= draft.length) return;
    setDraft((prev) => move(prev, i, j));
  }

  return (
    <SectionShell
      order={order}
      title="How It Works"
      whereItAppears="Homepage — the slim numbered-steps strip near the bottom of the page, just above the footer."
      dirty={dirty}
      status={status}
      error={error}
      onSave={() => void save()}
      onCancel={cancel}
    >
      <div className="space-y-3">
        {draft.map((d, i) => (
          <div key={d.id} className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[80px_1fr_auto]">
            <div>
              <label className={labelClasses}>Step #</label>
              <input className={inputClasses} value={d.number} onChange={(e) => update(i, { number: e.target.value })} />
            </div>
            <div>
              <label className={labelClasses}>Title</label>
              <input className={inputClasses} value={d.title} onChange={(e) => update(i, { title: e.target.value })} />
            </div>
            <div className="flex items-end gap-1">
              <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Move up">
                <Icon name="chevron-left" className="h-3.5 w-3.5 rotate-90" />
              </button>
              <button type="button" className="rounded-lg border border-neutral-300 p-2 hover:bg-neutral-100" disabled={i === draft.length - 1} onClick={() => reorder(i, 1)} aria-label="Move down">
                <Icon name="chevron-right" className="h-3.5 w-3.5 rotate-90" />
              </button>
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
        <Button type="button" variant="outline" size="md" onClick={add}>
          Add step
        </Button>
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------
// 10. Footer / Contact info
// ---------------------------------------------------------------------

function ContactInfoSection({ order, contactInfo, onSaved }: { order: number; contactInfo: AdminContactInfo | null; onSaved: () => Promise<void> }) {
  const serverValue = {
    phone: contactInfo?.phone ?? "",
    whatsapp: contactInfo?.whatsapp ?? "",
    email: contactInfo?.email ?? "",
    address: contactInfo?.address ?? "",
    hours: contactInfo?.hours ?? "",
    socialLinks: contactInfo?.socialLinks ?? ([] as SocialLink[]),
  };
  const { draft, setDraft, dirty, status, error, save, cancel } = useDraftSave("contact-info", "Footer & contact info", serverValue, async (d) => {
    await updateContactInfo({
      phone: d.phone || undefined,
      whatsapp: d.whatsapp || undefined,
      email: d.email || null,
      address: d.address || null,
      hours: d.hours || null,
      socialLinks: d.socialLinks,
    });
    await onSaved();
  });

  function addSocial() {
    setDraft((prev) => ({ ...prev, socialLinks: [...prev.socialLinks, { platform: "", url: "" }] }));
  }
  function updateSocial(i: number, patch: Partial<SocialLink>) {
    setDraft((prev) => ({ ...prev, socialLinks: prev.socialLinks.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  }
  function removeSocial(i: number) {
    setDraft((prev) => ({ ...prev, socialLinks: prev.socialLinks.filter((_, idx) => idx !== i) }));
  }

  return (
    <SectionShell
      order={order}
      title="Footer & contact info"
      whereItAppears="Site footer (every page) — the logo's social icons; the phone/WhatsApp number below are stored here for future use but not yet shown anywhere on the site (see the phase report)."
      dirty={dirty}
      status={status}
      error={error}
      onSave={() => void save()}
      onCancel={cancel}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Phone</label>
          <input className={inputClasses} value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
        </div>
        <div>
          <label className={labelClasses}>WhatsApp number</label>
          <input className={inputClasses} value={draft.whatsapp} onChange={(e) => setDraft((d) => ({ ...d, whatsapp: e.target.value }))} />
        </div>
        <div>
          <label className={labelClasses}>Email (optional)</label>
          <input className={inputClasses} value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
        </div>
        <div>
          <label className={labelClasses}>Hours (optional)</label>
          <input className={inputClasses} value={draft.hours} onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Address (optional)</label>
          <input className={inputClasses} value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
        </div>
      </div>

      <div className="mt-4 border-t border-neutral-200 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Social links (shown as icons in the footer)</p>
        <div className="mt-2 space-y-2">
          {draft.socialLinks.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input className={inputClasses} placeholder="Platform (e.g. Instagram)" value={s.platform} onChange={(e) => updateSocial(i, { platform: e.target.value })} />
              <input className={inputClasses} placeholder="https://…" value={s.url} onChange={(e) => updateSocial(i, { url: e.target.value })} />
              <button type="button" className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" onClick={() => removeSocial(i)} aria-label="Remove">
                <Icon name="trash" className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="md" className="mt-2" onClick={addSocial}>
          Add social link
        </Button>
      </div>
    </SectionShell>
  );
}

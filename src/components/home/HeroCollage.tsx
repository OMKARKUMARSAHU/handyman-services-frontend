import { HeroCollageImage } from "./HeroCollageImage";

export interface HeroCollageImageOverride {
  url: string;
  alt: string;
}

const DEFAULT_SCENES: { src: string; alt: string; fallbackIcon: string }[] = [
  { src: "/images/hero/scene-1.svg", alt: "Technician servicing an air conditioner", fallbackIcon: "air-vent" },
  { src: "/images/hero/scene-3.svg", alt: "Home appliance service visit", fallbackIcon: "wrench" },
  { src: "/images/hero/scene-4.svg", alt: "Technician servicing a kitchen appliance", fallbackIcon: "chef-hat" },
  { src: "/images/hero/scene-2.svg", alt: "Technician repairing a home appliance", fallbackIcon: "wrench" },
];

/**
 * Resolves the 4 collage slots (full layout) or 2 slots (compact layout)
 * against an optional Admin-managed override list (HOMEPAGE ADMIN
 * REBUILD — "Hero image gallery — separately editable image slots").
 * With no override (or an empty one), every slot keeps its original
 * default scene/alt/fallback-icon exactly as before — zero visual change
 * for a site that hasn't touched this yet. With an override, each slot
 * takes the next admin image in order, cycling (`% images.length`) so
 * even a single uploaded image fills every slot rather than leaving the
 * rest on the old defaults (which would look like a half-finished edit,
 * not a deliberate one) — reordering the admin list is what changes which
 * image lands in which slot.
 */
function resolveSlots(count: number, images: HeroCollageImageOverride[] | undefined) {
  return DEFAULT_SCENES.slice(0, count).map((fallback, i) => {
    if (!images || images.length === 0) return { src: fallback.src, alt: fallback.alt, fallbackIcon: fallback.fallbackIcon };
    const override = images[i % images.length];
    return { src: override.url, alt: override.alt || fallback.alt, fallbackIcon: fallback.fallbackIcon };
  });
}

/**
 * Hero's photographic collage (Phase 3 "major homepage visual rework" pass,
 * item 3/6) — replaces the previous green product-icon mosaic entirely,
 * per the client's explicit instruction that this be a structural change,
 * not a color swap. Each tile is independently graceful-fallback
 * (`HeroCollageImage`) so one failed/missing image never breaks the layout
 * or shows a broken-image icon. See `scripts/gen_hero_scenes.mjs` for why
 * these are original generated illustrations rather than real photographs
 * today.
 *
 * Two layouts, chosen by the caller (item 20 — "hero image collage should
 * transform into a proper mobile composition," not just disappear):
 * `compact` is a simple 2-up row for mobile/tablet (used below the
 * discovery panel); the default is the full 2x2 offset collage for
 * desktop, where there's room for it beside the panel.
 */
export function HeroCollage({ compact = false, images }: { compact?: boolean; images?: HeroCollageImageOverride[] }) {
  if (compact) {
    const [a, b] = resolveSlots(2, images);
    return (
      <div className="grid grid-cols-2 gap-3">
        <HeroCollageImage src={a.src} alt={a.alt} fallbackIcon={a.fallbackIcon} className="aspect-[4/3] w-full rounded-xl shadow-sm" />
        <HeroCollageImage src={b.src} alt={b.alt} fallbackIcon={b.fallbackIcon} className="aspect-[4/3] w-full rounded-xl shadow-sm" />
      </div>
    );
  }

  const [a, b, c, d] = resolveSlots(4, images);

  return (
    <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-3">
      <div className="flex flex-col gap-3">
        <HeroCollageImage src={a.src} alt={a.alt} fallbackIcon={a.fallbackIcon} className="aspect-[4/5] w-full rounded-2xl shadow-sm" />
        <HeroCollageImage src={b.src} alt={b.alt} fallbackIcon={b.fallbackIcon} className="aspect-square w-full rounded-2xl shadow-sm" />
      </div>
      <div className="flex translate-y-6 flex-col gap-3">
        <HeroCollageImage src={c.src} alt={c.alt} fallbackIcon={c.fallbackIcon} className="aspect-square w-full rounded-2xl shadow-sm" />
        <HeroCollageImage src={d.src} alt={d.alt} fallbackIcon={d.fallbackIcon} className="aspect-[4/5] w-full rounded-2xl shadow-sm" />
      </div>
    </div>
  );
}

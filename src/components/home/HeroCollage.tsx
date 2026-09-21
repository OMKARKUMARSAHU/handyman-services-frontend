import { HeroCollageImage } from "./HeroCollageImage";

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
export function HeroCollage({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <HeroCollageImage
          src="/images/hero/scene-1.svg"
          alt="Technician servicing an air conditioner"
          fallbackIcon="air-vent"
          className="aspect-[4/3] w-full rounded-xl shadow-sm"
        />
        <HeroCollageImage
          src="/images/hero/scene-2.svg"
          alt="Technician repairing a home appliance"
          fallbackIcon="wrench"
          className="aspect-[4/3] w-full rounded-xl shadow-sm"
        />
      </div>
    );
  }

  return (
    <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-3">
      <div className="flex flex-col gap-3">
        <HeroCollageImage
          src="/images/hero/scene-1.svg"
          alt="Technician servicing an air conditioner"
          fallbackIcon="air-vent"
          className="aspect-[4/5] w-full rounded-2xl shadow-sm"
        />
        <HeroCollageImage
          src="/images/hero/scene-3.svg"
          alt="Home appliance service visit"
          fallbackIcon="wrench"
          className="aspect-square w-full rounded-2xl shadow-sm"
        />
      </div>
      <div className="flex translate-y-6 flex-col gap-3">
        <HeroCollageImage
          src="/images/hero/scene-4.svg"
          alt="Technician servicing a kitchen appliance"
          fallbackIcon="chef-hat"
          className="aspect-square w-full rounded-2xl shadow-sm"
        />
        <HeroCollageImage
          src="/images/hero/scene-2.svg"
          alt="Technician repairing a home appliance"
          fallbackIcon="wrench"
          className="aspect-[4/5] w-full rounded-2xl shadow-sm"
        />
      </div>
    </div>
  );
}

import { Container } from "@/components/ui/Container";
import { HeroDiscoveryPanel } from "@/components/home/HeroDiscoveryPanel";
import { HeroCollage } from "@/components/home/HeroCollage";
import type { Category, Product } from "@/types";

/**
 * Homepage/city-homepage hero (Phase 3 "major homepage visual rework"
 * pass, item 3–6) — a full structural rebuild, not a color change. Removed
 * entirely: the "Book a Service"/"See How It Works" buttons, the circular
 * product-shortcut row, and the green icon mosaic. In their place: a left
 * heading + white bordered category-discovery panel (`HeroDiscoveryPanel`
 * — the primary action now comes from picking a tile there, not from a
 * marketing CTA button), and a right-side photographic collage
 * (`HeroCollage`). Urban Company's hero was used only as a UX/IA
 * reference for this general shape (heading + discovery panel + image
 * collage) — no Urban Company copy, branding, or assets are used; wording,
 * icons, illustrations, and markup are original to Handyman Services.
 *
 * Used by both the city-agnostic "/" homepage (citySlug undefined —
 * HeroDiscoveryPanel falls back to LocationProvider's last-selected city,
 * or the shared city selector) and the city-scoped "/[city]" homepage
 * (citySlug known from the URL, per PHASE_2_SYSTEM_ARCHITECTURE.md §4).
 */
export function Hero({
  eyebrow,
  heading,
  subheading,
  products,
  categories,
  citySlug,
}: {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  products: Product[];
  categories: Category[];
  citySlug?: string;
}) {
  return (
    <section className="border-b border-neutral-200 bg-white py-10 sm:py-14">
      <Container className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-600">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.75rem]">
            {heading}
          </h1>
          {subheading && (
            <p className="mt-3 max-w-xl text-base text-neutral-600">{subheading}</p>
          )}

          <div className="mt-6">
            <HeroDiscoveryPanel products={products} categories={categories} citySlug={citySlug} />
          </div>

          {/* Mobile/tablet: a compact collage below the panel instead of the
              desktop-only offset grid beside it — the collage still shows
              up on small screens, just in a layout that fits (item 20). */}
          <div className="mt-6 lg:hidden">
            <HeroCollage compact />
          </div>
        </div>

        <div className="hidden lg:block">
          <HeroCollage />
        </div>
      </Container>
    </section>
  );
}

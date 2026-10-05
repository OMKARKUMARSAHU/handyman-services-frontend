"use client";

import type { Offer } from "@/types";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HorizontalRailNavigation } from "@/components/ui/HorizontalRailNavigation";
import { useHorizontalRailScroll } from "@/lib/hooks/useHorizontalRailScroll";
import { OfferBannerImage } from "./OfferBannerImage";

/**
 * Image-led promotional strip — the "Spotlight" section pattern from the
 * Urban Company reference (layout/IA reference only; original Handyman
 * Services banner graphics, copy, and styling — see `scripts/gen_banners.py`).
 * Sourced entirely from the existing `Offer` entity (`bannerImage`, `title`,
 * `description`, `discountType`/`discountValue`) — no new data model
 * required for this section.
 *
 * Phase 3 "major homepage visual rework" pass (item 14): the previous
 * version was 4 large aspect-[4/5] tiles, each a full-bleed saturated
 * gradient banner — exactly the "huge green/orange/blue blocks" look the
 * client flagged. Redesigned as compact white cards with a small image
 * thumbnail (not full-bleed), a restrained discount chip, and clear text —
 * closer to a clean promotional tile than a billboard. `OfferBannerImage`'s
 * existing graceful-fallback behavior (unmounts on load error rather than
 * showing a broken-image glyph) is unchanged; only the surrounding layout
 * changed.
 */
export function SpotlightBanners({ offers }: { offers: Offer[] }) {
  // Hooks must run unconditionally, before the `offers.length === 0` early
  // return below.
  const { ref: scrollRef, canScrollLeft, canScrollRight, onScrollLeft, onScrollRight } =
    useHorizontalRailScroll<HTMLDivElement>(offers.map((o) => o.id).join(","));

  if (offers.length === 0) return null;

  return (
    <section className="py-10 sm:py-12">
      <SectionHeading eyebrow="Spotlight" heading="Offers you don't want to miss" />
      <Container className="mt-6">
        <div className="relative">
          <div
            ref={scrollRef}
            role="region"
            aria-label="Offers you don't want to miss — scrollable list"
            tabIndex={0}
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="flex w-[260px] shrink-0 snap-start items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm sm:w-auto"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  {offer.bannerImage && (
                    <OfferBannerImage src={offer.bannerImage} className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  {offer.discountValue > 0 && (
                    <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                      {offer.discountType === "percent"
                        ? `${offer.discountValue}% off`
                        : `₹${offer.discountValue} off`}
                    </span>
                  )}
                  <p className="mt-1 truncate text-sm font-bold text-neutral-900">{offer.title}</p>
                  <p className="line-clamp-2 text-xs text-neutral-500">{offer.description}</p>
                </div>
              </div>
            ))}
          </div>
          <HorizontalRailNavigation
            canScrollLeft={canScrollLeft}
            canScrollRight={canScrollRight}
            onScrollLeft={onScrollLeft}
            onScrollRight={onScrollRight}
            label="Offers you don't want to miss"
          />
        </div>
      </Container>
    </section>
  );
}

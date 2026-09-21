"use client";

import { useState } from "react";
import type { Offer, PromotionalBannerContent } from "@/types";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";

const ARTWORK = [
  "/images/spotlight/large-banner-teal.svg",
  "/images/spotlight/large-banner-amber.svg",
];

/**
 * Large promotional banner carousel — the homepage's primary promotional
 * moment (Post-QA Revision 2, item 2), now placed at *two* points on the
 * homepage per the "FINAL HOMEPAGE / UX CORRECTION" pass (item 4 — see
 * app/page.tsx and app/[city]/page.tsx's section-order doc comments). The
 * small offer cards (`SpotlightBanners`) are kept, not deleted, and sit
 * further down the page as secondary/"more discovery" content — the
 * client's instruction was "don't use small cards as a replacement for
 * large banners," not "remove the small cards."
 *
 * This component renders `PromotionalBannerContent[]` — the exact reusable
 * field shape the client specified (id, eyebrow, title, subtitle, ctaText,
 * ctaLink, image, background, badge) — never `Offer` directly. Today the
 * only banner source this mock-data phase has is the active `Offer` list,
 * so `offersToBanners()` below maps each `Offer` into that shape at render
 * time rather than introducing a second, parallel "promotional banners"
 * data file that could drift out of sync with the real discount it's
 * promoting (there's exactly one place discount data lives: `offers.ts`).
 * A future Admin Panel can add a dedicated banner data source with real
 * `ctaText`/`ctaLink`/image-per-banner fields — the component below would
 * take that array directly, unchanged, since it already only reads the
 * generic shape:
 *  - `ctaText` is a fixed, honest "Explore offer" (no invented urgency
 *    copy like "Book now — limited time").
 *  - `ctaLink` resolves `offer.appliesTo` to a real, working route: a
 *    `category` scope links to that category's page; a `service` scope
 *    resolves the service's product to its category; `all` scope links to
 *    the general services listing. On a city homepage (`citySlug` set)
 *    this resolves to the city-scoped category route; on the city-agnostic
 *    homepage it resolves to the city-agnostic `/services/[category]`
 *    fallback route. Never a dead link, never a fabricated one.
 *  - `badge` is the offer's real discount ("10% off" / "₹100 off"), or
 *    omitted when there's nothing to show — never a fabricated urgency
 *    badge ("Selling fast", "Limited stock").
 *
 * The banner artwork (`public/images/spotlight/large-banner-*.svg`) is
 * original, text-free decorative art in the project's existing brand-teal
 * / accent-gold gradient language — deliberately separate from the small
 * cards' own `bannerImage` assets, which already have their offer title
 * baked into the SVG at thumbnail scale. Reusing those at full banner
 * width would show the title twice (once baked into the image, once as
 * this component's real HTML heading); fresh, text-free art avoids that
 * and keeps the visible headline as real, accessible text.
 *
 * `startIndex` lets a second instance on the same page open on a
 * different banner/artwork than the first, so two banners don't show
 * identical content before anyone interacts with either — each instance
 * still cycles through every banner independently via its own local
 * `index` state.
 */
export function LargeSpotlightBanner({
  offers,
  citySlug,
  services,
  products,
  categories,
  startIndex = 0,
}: {
  offers: Offer[];
  citySlug?: string;
  services?: { id: string; productId: string }[];
  products?: { id: string; categoryId: string }[];
  categories?: { id: string }[];
  startIndex?: number;
}) {
  const [index, setIndex] = useState(startIndex);
  const banners = offersToBanners(offers, { citySlug, services, products, categories });
  if (banners.length === 0) return null;

  const current = banners[index % banners.length];

  function go(delta: number) {
    setIndex((i) => (i + delta + banners.length) % banners.length);
  }

  return (
    <section className="py-10 sm:py-14">
      <Container>
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- original in-house SVG artwork (decorative, no Next Image SVG optimization needed), same plain-<img> pattern as OfferBannerImage.tsx */}
          <img
            src={current.image}
            alt={current.imageAlt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                current.background ??
                "linear-gradient(to right, rgba(0,0,0,0.45), rgba(0,0,0,0.1) 60%, transparent)",
            }}
          />

          <div className="relative flex min-h-[300px] flex-col justify-center gap-4 px-6 py-10 sm:min-h-[340px] sm:px-10 md:max-w-xl md:py-14 lg:px-14">
            {current.eyebrow && (
              <p className="text-xs font-bold uppercase tracking-wide text-white/70">
                {current.eyebrow}
              </p>
            )}
            {current.badge && (
              <span className="inline-flex w-fit items-center rounded-full bg-white/95 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 shadow-sm">
                {current.badge}
              </span>
            )}
            <h2 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
              {current.title}
            </h2>
            {current.subtitle && (
              <p className="max-w-md text-sm text-white/85 sm:text-base">{current.subtitle}</p>
            )}
            <Button href={current.ctaLink} variant="secondary" size="lg" className="mt-2 w-fit">
              {current.ctaText}
            </Button>
          </div>

          {banners.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous offer"
                className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-md transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex"
              >
                <Icon name="chevron-left" className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next offer"
                className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-md transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex"
              >
                <Icon name="chevron-right" className="h-5 w-5" />
              </button>

              <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
                {banners.map((banner, i) => (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show offer ${i + 1} of ${banners.length}: ${banner.title}`}
                    aria-current={i === index}
                    className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                      i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/75"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </Container>
    </section>
  );
}

function offersToBanners(
  offers: Offer[],
  ctx: {
    citySlug?: string;
    services?: { id: string; productId: string }[];
    products?: { id: string; categoryId: string }[];
    categories?: { id: string }[];
  }
): PromotionalBannerContent[] {
  return offers.map((offer, i) => ({
    id: offer.id,
    eyebrow: "Limited-time offer",
    title: offer.title,
    subtitle: offer.description,
    ctaText: "Explore offer",
    ctaLink: resolveOfferHref(offer, ctx),
    image: ARTWORK[i % ARTWORK.length],
    imageAlt: "",
    badge:
      offer.discountValue > 0
        ? offer.discountType === "percent"
          ? `${offer.discountValue}% off`
          : `₹${offer.discountValue} off`
        : null,
  }));
}

function resolveOfferHref(
  offer: Offer,
  ctx: {
    citySlug?: string;
    services?: { id: string; productId: string }[];
    products?: { id: string; categoryId: string }[];
    categories?: { id: string }[];
  }
): string {
  const cityPrefix = ctx.citySlug ? `/${ctx.citySlug}` : "";

  if (offer.appliesTo.scope === "category" && offer.appliesTo.ids[0]) {
    const categoryId = offer.appliesTo.ids[0];
    return ctx.citySlug ? `${cityPrefix}/${categoryId}` : `/services/${categoryId}`;
  }

  if (offer.appliesTo.scope === "service" && offer.appliesTo.ids[0] && ctx.services && ctx.products) {
    const service = ctx.services.find((s) => s.id === offer.appliesTo.ids[0]);
    const product = service ? ctx.products.find((p) => p.id === service.productId) : undefined;
    if (product) {
      return ctx.citySlug ? `${cityPrefix}/${product.categoryId}` : `/services/${product.categoryId}`;
    }
  }

  return "/services";
}

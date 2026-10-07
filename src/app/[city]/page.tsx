import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCityBySlugSync } from "@/lib/data/cities";
import { getAllServicesSync } from "@/lib/data/services";
import {
  getCategoriesLive,
  getAllProductsLive,
  getFeaturedServicesLive,
  getMostBookedServicesLive,
  getServicesByCategoryLive,
  getOffersLive,
  getHomepageSectionLive,
  getVideoCurationsLive,
} from "@/lib/data/live";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { LargeSpotlightBanner } from "@/components/home/LargeSpotlightBanner";
import { SpotlightBanners } from "@/components/home/SpotlightBanners";
import { ServiceRail } from "@/components/catalog/ServiceRail";
import { HowItWorks } from "@/components/home/HowItWorks";
import { VideoCurationRail } from "@/components/home/VideoCurationRail";

/**
 * Converts a homepage_sections "hero" row's generic `items` array into the
 * Hero image-collage override shape (HOMEPAGE ADMIN REBUILD — "Hero image
 * gallery"). Each item is a flat `{ slot, url, alt }` record (same generic
 * items column every other homepage collection already uses — see
 * AdminHomepageContentPanel.tsx's HeroImagesEditor); `url`-less rows are
 * dropped rather than rendered as a broken slot. Returns `undefined` (not
 * an empty array) when there is nothing usable, so `HeroCollage` falls
 * back to its own default scenes exactly as it did before this feature
 * existed.
 */
function toHeroImages(items: { url?: string | number; alt?: string | number }[] | null | undefined) {
  if (!items || items.length === 0) return undefined;
  const images = items
    .map((it) => ({ url: it.url != null ? String(it.url) : "", alt: it.alt != null ? String(it.alt) : "" }))
    .filter((img) => img.url.length > 0);
  return images.length > 0 ? images : undefined;
}


/**
 * BUILD-TIME FIX (Vercel build timeout -- "took more than 60 seconds ...
 * after 3 attempts ... Next.js build worker exited with code: 1"): this
 * previously returned every active city, forcing `next build` to eagerly
 * render every single `/[city]` page right now by calling this page's
 * body -- which fetches live catalog/homepage data from the backend via
 * `@/lib/data/live` -- once per city, synchronously, during the build. If
 * the backend is slow, cold, or unreachable from Vercel's build network
 * at that moment, a render can hang past Next's internal per-page budget,
 * and after 3 retries Next kills the build.
 *
 * Returning an empty array means `next build` pre-renders ZERO `/[city]`
 * pages -- no backend calls happen at build time, so the build can never
 * fail because of backend latency/unavailability again. `dynamicParams`
 * below (default `true`, made explicit so this can't silently regress)
 * is what keeps every `/[city]` URL working exactly as before: the first
 * visitor to any city renders it on demand (full server-rendered HTML,
 * same `generateMetadata` above, same live-data fetch, same mock
 * fallback), and Next then caches that render per the `revalidate: 30`
 * already set on every call in `@/lib/data/live` -- this is Incremental
 * Static Regeneration seeded at request time instead of enumerated at
 * build time, not a switch to client-side or uncached rendering.
 */
export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getCityBySlugSync(citySlug);
  if (!city) return {};
  return {
    title: `Home Services in ${city.name}`,
    description: `Browse appliance repair, installation, service and AMC plans available in ${city.name}.`,
  };
}

/**
 * City homepage — the fully city-scoped counterpart to "/", carrying the
 * same "FINAL HOMEPAGE / UX CORRECTION" section order server-side, since
 * the city is already known from the URL (PHASE_2_SYSTEM_ARCHITECTURE.md
 * §4 — the URL is the source of truth, not a client-only fallback). Its
 * hero renders the same shared `Hero` component as "/" (heading/subheading
 * text specific to this city, citySlug known so every discovery-panel tile
 * links straight to a resolved route with no city-selector step) — see
 * Hero.tsx and app/page.tsx's doc comment for the full rationale behind
 * the hero and the current section order (two `LargeSpotlightBanner`
 * placements bracketing the catalog-discovery block, Video Curations right
 * after the second banner, FAQ and the Final CTA section both removed).
 *
 * AUDIT FOLLOW-UP ("Admin CMS/content-management pipeline"): categories,
 * products, featured/most-booked/by-category services, offers/banners,
 * trust strip and video curations all now read through `@/lib/data/live`
 * (the real backend the Admin CMS writes to), each falling back to the
 * exact same mock reader it replaces if the backend is unreachable — see
 * `src/lib/data/live.ts`. City selection itself (`cities.ts`,
 * `getCityBySlugSync`) is deliberately untouched — out of scope, and the
 * existing auth/session/cookie architecture must not change. `services`
 * (passed to `LargeSpotlightBanner` only, for resolving a service-scoped
 * offer's CTA link) stays on the mock, synchronous reader — see the
 * matching comment in `app/page.tsx`.
 */
export default async function CityHomePage({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  const city = getCityBySlugSync(citySlug);
  if (!city) notFound();

  const [categories, products, featured, mostBooked, offers, whyChooseUsSection, howItWorksSection, videoCurations, heroSection] =
    await Promise.all([
      getCategoriesLive(),
      getAllProductsLive(),
      getFeaturedServicesLive(city.slug),
      getMostBookedServicesLive(city.slug),
      getOffersLive({ citySlug: city.slug }),
      getHomepageSectionLive("whyChooseUs"),
      getHomepageSectionLive("howItWorks"),
      getVideoCurationsLive(),
      getHomepageSectionLive("hero"),
    ]);
  const services = getAllServicesSync();
  const categoryRails = await Promise.all(
    categories.map(async (category) => ({
      category,
      services: await getServicesByCategoryLive(category.id, { citySlug: city.slug, limit: 10 }),
    }))
  );

  return (
    <>
      {/*
        HOMEPAGE ADMIN REBUILD: only the hero's image collage is shared
        with the Admin-managed "hero" homepage_sections row here — the
        heading/subheading stay the existing per-city-generated text
        (`Home services in ${city.name}`, unchanged), never the global
        "hero" row's heading/subheading, which is a single site-wide value
        and would otherwise make every city's hero show identical text
        and lose the "in {city.name}" personalization the moment an admin
        edits the Hero section on "/". That text override is deliberately
        NOT applied here — see app/page.tsx, where the city-agnostic
        homepage (which has no per-city text to lose) does use it.
      */}
      <Hero
        eyebrow="Now browsing"
        heading={`Home services in ${city.name}`}
        subheading={`Installation, service, repair and AMC for your everyday appliances — scoped to what's currently available in ${city.name}.`}
        products={products}
        categories={categories}
        citySlug={city.slug}
        heroImages={toHeroImages(heroSection?.items)}
      />

      {whyChooseUsSection && <TrustStrip section={whyChooseUsSection} />}

      <LargeSpotlightBanner
        offers={offers}
        citySlug={city.slug}
        services={services}
        products={products}
        categories={categories}
      />

      <ServiceRail
        eyebrow="New & Noteworthy"
        heading="Recently added services"
        services={featured}
        citySlug={city.slug}
      />

      {/* Relabeled per the Phase 3 final visual-audit pass — see HomeDiscoveryRails.tsx's matching comment. */}
      <ServiceRail
        eyebrow="Featured"
        heading="Featured Services"
        services={mostBooked}
        citySlug={city.slug}
      />

      {categoryRails.map(({ category, services }) => (
        <ServiceRail
          key={category.id}
          eyebrow={category.name}
          heading={`${category.name} services in ${city.name}`}
          subheading={category.description}
          services={services}
          citySlug={city.slug}
          seeAllHref={`/${city.slug}/${category.id}`}
        />
      ))}

      <section className="py-14 sm:py-16">
        <SectionHeading
          eyebrow="Browse by Category"
          heading="What do you need serviced?"
          subheading={`Explore categories to see products and services available in ${city.name}.`}
        />
        <div className="mt-10">
          <CategoryGrid categories={categories} citySlug={city.slug} />
        </div>
      </section>

      <LargeSpotlightBanner
        offers={offers}
        citySlug={city.slug}
        services={services}
        products={products}
        categories={categories}
        startIndex={1}
      />

      <VideoCurationRail
        eyebrow="See It In Action"
        heading="Real service visits, on video"
        subheading={`A look at what a technician visit actually involves in ${city.name}.`}
        curations={videoCurations}
      />

      <SpotlightBanners offers={offers} />

      {howItWorksSection && (
        <section className="py-10 sm:py-12">
          <HowItWorks section={howItWorksSection} />
        </section>
      )}
    </>
  );
}

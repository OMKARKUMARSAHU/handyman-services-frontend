import type { Metadata } from "next";
import { getAllServicesSync } from "@/lib/data/services";
import {
  getHomepageSectionLive,
  getCategoriesLive,
  getAllProductsLive,
  getVideoCurationsLive,
  getOffersLive,
} from "@/lib/data/live";
import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { LargeSpotlightBanner } from "@/components/home/LargeSpotlightBanner";
import { SpotlightBanners } from "@/components/home/SpotlightBanners";
import { HomeDiscoveryRails } from "@/components/home/HomeDiscoveryRails";
import { HowItWorks } from "@/components/home/HowItWorks";
import { VideoCurationRail } from "@/components/home/VideoCurationRail";
import { SectionHeading } from "@/components/ui/SectionHeading";

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


export const metadata: Metadata = {
  title: "Handyman Services — Home appliance installation, service, repair & AMC.",
  description:
    "A location-first home services marketplace. Pick your city, browse categories, and book installation, service, repair or AMC for your home appliances.",
};

/**
 * Homepage — reworked again in the "FINAL HOMEPAGE / UX CORRECTION" pass,
 * a reference-driven structural correction (not a CSS-only pass) against a
 * general marketplace UX/IA reference (layout/interaction patterns only —
 * no copied copy, branding, or assets anywhere in this codebase; see
 * Hero.tsx's own doc comment).
 *
 * Section order: Header (layout) → Hero (discovery panel + photo collage)
 * → Trust strip (compact, real data) → **Large Promotional Banner #1** →
 * New & Noteworthy → Featured Services → Category-wise rails → Browse by
 * Category → **Large Promotional Banner #2** → Video Curations/"See It In
 * Action" → Spotlight/Offers (compact, secondary) → How It Works (compact)
 * → Footer. This is the client's own specified order (item 3): two large
 * banners bracketing the catalog-discovery block, Video Curations right
 * after the second banner, and any further discovery content — the small
 * offer cards, the compact How It Works strip — after that, before the
 * footer.
 *
 * AUDIT FOLLOW-UP ("Admin CMS/content-management pipeline"): every section
 * below that is supposed to be Admin-editable (hero, trust strip,
 * categories, products, offers/banners, video curations) now reads through
 * `@/lib/data/live` — the real backend database the Admin CMS panels write
 * to — instead of the repo's static `src/data/*.json`. Each `*Live`
 * function falls back to the exact same mock reader it replaces if the
 * backend is unreachable, so this page can never render blank; see
 * `src/lib/data/live.ts`'s doc comment for the full rationale. `services`
 * below stays on the mock, synchronous reader deliberately — it's only
 * used by `LargeSpotlightBanner` to resolve a *service*-scoped offer's CTA
 * link to a category (a cosmetic fallback-to-generic-link concern, not
 * content), and `getOffersLive` already documents why that one link
 * degrades gracefully for service-scoped offers rather than being wired
 * up end-to-end this pass.
 */
export default async function HomePage() {
  const [heroSection, whyChooseUsSection, howItWorksSection, categories, products, videoCurations, offers] =
    await Promise.all([
      getHomepageSectionLive("hero"),
      getHomepageSectionLive("whyChooseUs"),
      getHomepageSectionLive("howItWorks"),
      getCategoriesLive(),
      getAllProductsLive(),
      getVideoCurationsLive(),
      getOffersLive(),
    ]);
  const services = getAllServicesSync();

  return (
    <>
      {heroSection && (
        <Hero
          heading={heroSection.heading}
          subheading={heroSection.subheading ?? undefined}
          products={products}
          categories={categories}
          heroImages={toHeroImages(heroSection.items)}
        />
      )}

      {whyChooseUsSection && <TrustStrip section={whyChooseUsSection} />}

      <LargeSpotlightBanner offers={offers} services={services} products={products} categories={categories} />

      <HomeDiscoveryRails categories={categories} />

      <section className="py-14 sm:py-16">
        <SectionHeading
          eyebrow="Browse by Category"
          heading="What do you need serviced?"
          subheading="Explore appliance categories — pick your city to see exactly what's available near you."
        />
        <div className="mt-10">
          <CategoryGrid categories={categories} />
        </div>
      </section>

      <LargeSpotlightBanner
        offers={offers}
        services={services}
        products={products}
        categories={categories}
        startIndex={1}
      />

      <VideoCurationRail
        eyebrow="See It In Action"
        heading="Real service visits, on video"
        subheading="A look at what a technician visit actually involves."
        curations={videoCurations}
      />

      <SpotlightBanners offers={offers} />

      {howItWorksSection && (
        <section id="how-it-works" className="py-10 sm:py-12">
          <HowItWorks section={howItWorksSection} />
        </section>
      )}
    </>
  );
}

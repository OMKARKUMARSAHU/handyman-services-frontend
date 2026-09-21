import type { Metadata } from "next";
import { getHomepageSection, getCategories, getVideoCurations } from "@/lib/data";
import { getOffers } from "@/lib/data/offers";
import { getAllProductsSync } from "@/lib/data/products";
import { getAllServicesSync } from "@/lib/data/services";
import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { LargeSpotlightBanner } from "@/components/home/LargeSpotlightBanner";
import { SpotlightBanners } from "@/components/home/SpotlightBanners";
import { HomeDiscoveryRails } from "@/components/home/HomeDiscoveryRails";
import { HowItWorks } from "@/components/home/HowItWorks";
import { VideoCurationRail } from "@/components/home/VideoCurationRail";
import { SectionHeading } from "@/components/ui/SectionHeading";

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
 * Three changes from this order relative to earlier rounds, all removals:
 *  - **FAQ is gone from the homepage entirely** (item 2) — the `/faq`
 *    route and its data/accessor (`getFAQs`, `faqs.json`) are completely
 *    untouched and still fully reachable; this page just no longer renders
 *    a preview of it. `FAQAccordion` is still used by `/faq` itself.
 *  - **The Final CTA section is gone** (item 16 — "giant CTA section" /
 *    "unnecessary 'book a service' corporate CTA blocks"). `CTASection`
 *    and the `finalCta` homepage-section entry are kept, unused, the same
 *    way `Testimonials` was kept unused after its own removal — nothing
 *    referencing them is deleted, in case a real, non-generic closing CTA
 *    is wanted again later.
 *  - The large promotional banner now appears **twice** (item 4 — "use
 *    multiple banners at different points in the homepage") instead of
 *    once; the second instance uses `startIndex={1}` purely so the two
 *    don't show identical content before anyone interacts with either
 *    (see LargeSpotlightBanner.tsx).
 *
 * Two carryovers, both documented at their own component: (1) "Trust /
 * rating / customer statistics" is the existing `whyChooseUs` data shown
 * as a compact strip, not fabricated figures (see TrustStrip.tsx) — this
 * is real, non-"excessive" content and wasn't targeted for removal; (2)
 * Testimonials stay removed (customer quotes/ratings were all
 * mock/placeholder content — presenting them as real customer evidence
 * was misleading) — `TestimonialCarousel`/`TestimonialCard` and
 * `testimonials.ts`/`testimonials.json` stay kept, unused.
 *
 * The rail sections (New & Noteworthy / Featured / Category-wise) need a
 * city to filter availability and build working links; this page is a
 * server component with no city known at request time, so that piece is
 * delegated to the client `HomeDiscoveryRails`, which uses a
 * previously-selected city from LocationProvider if one exists, or an
 * honest "select your city" prompt if not (see that component's doc
 * comment — this mirrors the reasoning already used for CategoryCard).
 */
export default async function HomePage() {
  const heroSection = getHomepageSection("hero");
  const whyChooseUsSection = getHomepageSection("whyChooseUs");
  const howItWorksSection = getHomepageSection("howItWorks");
  const categories = getCategories();
  const products = getAllProductsSync();
  const services = getAllServicesSync();
  const videoCurations = getVideoCurations();

  // City-unfiltered — no Offer record is city-scoped today (see offers.ts).
  const offers = await getOffers();

  return (
    <>
      {heroSection && (
        <Hero
          heading={heroSection.heading}
          subheading={heroSection.subheading ?? undefined}
          products={products}
          categories={categories}
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

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllCitiesSync, getCityBySlugSync } from "@/lib/data/cities";
import { getCategories } from "@/lib/data/categories";
import { getAllProductsSync } from "@/lib/data/products";
import {
  getFeaturedServices,
  getMostBookedServices,
  getServicesByCategory,
  getAllServicesSync,
} from "@/lib/data/services";
import { getOffers } from "@/lib/data/offers";
import { getHomepageSection, getVideoCurations } from "@/lib/data";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { LargeSpotlightBanner } from "@/components/home/LargeSpotlightBanner";
import { SpotlightBanners } from "@/components/home/SpotlightBanners";
import { ServiceRail } from "@/components/catalog/ServiceRail";
import { HowItWorks } from "@/components/home/HowItWorks";
import { VideoCurationRail } from "@/components/home/VideoCurationRail";

export function generateStaticParams() {
  return getAllCitiesSync().map((city) => ({ city: city.slug }));
}

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
 */
export default async function CityHomePage({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  const city = getCityBySlugSync(citySlug);
  if (!city) notFound();

  const categories = getCategories();
  const products = getAllProductsSync();
  const services = getAllServicesSync();
  const featured = await getFeaturedServices(city.id);
  const mostBooked = await getMostBookedServices(city.id);
  const offers = await getOffers({ cityId: city.id });
  const categoryRails = await Promise.all(
    categories.map(async (category) => ({
      category,
      services: await getServicesByCategory(category.id, { cityId: city.id, limit: 10 }),
    }))
  );

  const whyChooseUsSection = getHomepageSection("whyChooseUs");
  const howItWorksSection = getHomepageSection("howItWorks");
  const videoCurations = getVideoCurations();

  return (
    <>
      <Hero
        eyebrow="Now browsing"
        heading={`Home services in ${city.name}`}
        subheading={`Installation, service, repair and AMC for your everyday appliances — scoped to what's currently available in ${city.name}.`}
        products={products}
        categories={categories}
        citySlug={city.slug}
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

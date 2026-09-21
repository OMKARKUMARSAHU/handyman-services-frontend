"use client";

import type { Category } from "@/types";
import { useLocation } from "@/lib/state/LocationProvider";
import { getCityBySlugSync } from "@/lib/data/cities";
import {
  getFeaturedServicesSync,
  getMostBookedServicesSync,
  getServicesByCategorySync,
} from "@/lib/data/services";
import { ServiceRail } from "@/components/catalog/ServiceRail";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/**
 * The city-agnostic "/" homepage's New & Noteworthy / Most Booked /
 * category-wise rails. These need a city to (a) filter by availability and
 * (b) build working "See all" / card links, and the city-agnostic homepage
 * is a server component that doesn't know the visitor's city at request
 * time — only LocationProvider's client-only `lastCitySlug` (localStorage)
 * might know it.
 *
 * With a known last-selected city: render the full rail stack, scoped to
 * it, exactly as the city homepage (/[city]) does server-side.
 * With no known city yet: show an honest prompt instead of either
 * fabricating a city-less catalog or silently omitting the section with no
 * explanation — consistent with the project's existing empty-state
 * practice (see ServiceList's "Not yet available in this city").
 */
export function HomeDiscoveryRails({ categories }: { categories: Category[] }) {
  const { lastCitySlug, openCitySelector } = useLocation();
  const city = lastCitySlug ? getCityBySlugSync(lastCitySlug) : undefined;

  if (!city) {
    return (
      <section className="py-12 sm:py-16">
        <Container>
          {/*
            Phase 3 "major homepage visual rework" pass (item 1): was a
            solid brand-green-tinted box (border-brand-300/bg-brand-50) —
            one of several large green fills contributing to the "too
            green" homepage feel. Neutral border/background now; the CTA
            button below is still brand-colored, which is enough to draw
            the eye without another full-width green panel.
          */}
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <h2 className="text-lg font-bold text-neutral-900">
              See top-rated &amp; most-booked services near you
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              Select your city to unlock New &amp; Noteworthy picks, Most Booked services and
              category-wise browsing scoped to what&rsquo;s available near you.
            </p>
            <Button className="mt-5" onClick={() => openCitySelector()}>
              Select your city
            </Button>
          </div>
        </Container>
      </section>
    );
  }

  const featured = getFeaturedServicesSync(city.id);
  const mostBooked = getMostBookedServicesSync(city.id);

  return (
    <>
      <ServiceRail
        eyebrow="New & Noteworthy"
        heading="Recently added services"
        services={featured}
        citySlug={city.slug}
      />
      {/*
        Phase 3 final visual-audit pass: relabeled from "Most Booked
        Services" — no real order/booking-volume data exists in this
        mock-data phase (this rail is driven by the Admin-curated
        `isMostBooked` flag, not a computed ranking; see services.ts), so a
        "most booked" claim isn't one the data actually supports. "Popular"
        reads the same way, so it changed too. The underlying flag/function
        names are unchanged — this is a display-label-only fix.
      */}
      <ServiceRail
        eyebrow="Featured"
        heading="Featured Services"
        services={mostBooked}
        citySlug={city.slug}
      />
      {categories.map((category) => {
        const services = getServicesByCategorySync(category.id, { cityId: city.id, limit: 10 });
        return (
          <ServiceRail
            key={category.id}
            eyebrow={category.name}
            heading={`${category.name} services in ${city.name}`}
            subheading={category.description}
            services={services}
            citySlug={city.slug}
            seeAllHref={`/${city.slug}/${category.id}`}
          />
        );
      })}
    </>
  );
}

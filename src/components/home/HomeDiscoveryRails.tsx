"use client";

import { useEffect, useState } from "react";
import type { Category, Service } from "@/types";
import { useLocation } from "@/lib/state/LocationProvider";
import { ServiceRail } from "@/components/catalog/ServiceRail";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { cityKey, classifyHttpStatus, pickCityView, type CityFetchState, type FetchErrorKind } from "@/lib/city/cityView";
import { withRateLimitRetry } from "@/lib/city/retry";
import { cityResultKey, createTtlCache } from "@/lib/city/ttlCache";

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
 *
 * CITY-SWITCHING FIX: results are stored and shown PER CITY — a city's rails are only ever rendered for that
 * city, an earlier city's slower response is aborted and cannot overwrite the current one, a failed request shows
 * an error with a Retry (the bundled mock catalog is no longer substituted for live data), and results are cached
 * for 30s per city so switching back is instant.
 */
interface LiveRails {
  citySlug: string;
  featured: Service[];
  mostBooked: Service[];
  byCategory: Record<string, Service[]>;
}

class RailsRequestError extends Error {
  constructor(readonly status: number) {
    super(`home-rails ${status}`);
  }
}

const railsCache = createTtlCache<LiveRails>(30_000);

async function fetchRails(citySlug: string, signal: AbortSignal): Promise<LiveRails> {
  const res = await fetch(`/api/home-rails?city=${encodeURIComponent(citySlug)}`, { signal });
  if (!res.ok) throw new RailsRequestError(res.status);
  const data = (await res.json()) as LiveRails;
  // Defence in depth: never accept a payload that is not for the city we asked about.
  if (data.citySlug !== citySlug) throw new RailsRequestError(502);
  return data;
}

export function HomeDiscoveryRails({ categories }: { categories: Category[] }) {
  const { lastCitySlug, openCitySelector, getCity } = useLocation();
  const city = getCity(lastCitySlug);
  const citySlug = city?.slug;
  const [byKey, setByKey] = useState<Record<string, NonNullable<CityFetchState<LiveRails>>>>({});
  const [attempt, setAttempt] = useState(0);
  const resultKey = cityResultKey(citySlug, "rails");

  // CITY-WISE PRICING: the rails show the same live, city-resolved services the city homepage
  // (/[city]) renders server-side, so every price here is the selected city's price (or the base
  // price where that city has none) and updates when the visitor changes city. They are fetched
  // through /api/home-rails (server-side, 30s shared cache) rather than by the browser directly.
  useEffect(() => {
    if (!citySlug) return;
    const key = cityKey(citySlug);
    const cached = attempt === 0 ? railsCache.get(resultKey) : undefined;
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show an already-fetched result for this city immediately
      setByKey((prev) => ({ ...prev, [resultKey]: { key, status: "ok", data: cached } }));
      return;
    }
    const controller = new AbortController();
    withRateLimitRetry(() => fetchRails(citySlug, controller.signal), {
      isRateLimited: (err) => err instanceof RailsRequestError && err.status === 429,
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        railsCache.set(resultKey, data);
        setByKey((prev) => ({ ...prev, [resultKey]: { key, status: "ok", data } }));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const kind: FetchErrorKind = err instanceof RailsRequestError ? classifyHttpStatus(err.status) : "failed";
        setByKey((prev) => ({ ...prev, [resultKey]: { key, status: "error", kind } }));
      });
    return () => controller.abort();
  }, [citySlug, resultKey, attempt]);

  function retry() {
    railsCache.clear();
    setByKey((prev) => {
      const next = { ...prev };
      delete next[resultKey];
      return next;
    });
    setAttempt((a) => a + 1);
  }

  const view = pickCityView<LiveRails>({ citySlug, initialCity: null, initialOk: false, fetched: byKey[resultKey] ?? null });

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

  // Until this city's live prices have loaded, hold the space rather than flashing another city's or base prices.
  if (view.kind === "loading" || view.kind === "initial") {
    return <section aria-busy="true" aria-label="Loading services for your city" className="min-h-[24rem]" />;
  }
  if (view.kind === "error") {
    return (
      <section className="py-12 sm:py-16">
        <Container>
          <div role="alert" className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <h2 className="text-lg font-bold text-neutral-900">
              {view.error === "city_unavailable" ? "Services are not available for this city" : `We couldn't load services for ${city.name}`}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              {view.error === "city_unavailable"
                ? "Please choose another city to see what's available near you."
                : view.error === "rate_limited"
                  ? "Too many requests just now. Please try again in a moment."
                  : "Please check your connection and try again."}
            </p>
            {view.error === "city_unavailable" ? (
              <Button className="mt-5" onClick={() => openCitySelector()}>
                Choose another city
              </Button>
            ) : (
              <Button className="mt-5" onClick={retry}>
                Try again
              </Button>
            )}
          </div>
        </Container>
      </section>
    );
  }
  const live = view.data;
  const { featured, mostBooked } = live;

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
        const services = live.byCategory[category.id] ?? [];
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

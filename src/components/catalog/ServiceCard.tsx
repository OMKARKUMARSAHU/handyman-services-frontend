"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Service } from "@/types";
import { formatINR } from "@/lib/format";
import { Icon } from "@/lib/icons";
import { useCart } from "@/lib/state/CartProvider";
import { useLocation } from "@/lib/state/LocationProvider";

/**
 * `citySlug` is optional so this card can be used in city-agnostic contexts
 * (e.g. the "/" homepage rails, before a city is chosen) — same fallback
 * pattern as CategoryCard: fall back to the last-selected-city convenience
 * value, and if there's still no city, open the shared city selector rather
 * than navigating to or adding-to-cart against a route/city that doesn't
 * resolve (PHASE_2_SYSTEM_ARCHITECTURE.md §4 "scope, don't gate").
 */
export function ServiceCard({ service, citySlug }: { service: Service; citySlug?: string }) {
  const { addToCart } = useCart();
  const { lastCitySlug, openCitySelector } = useLocation();
  const router = useRouter();
  const image = service.images[0]?.url ?? null;
  const effectiveCitySlug = citySlug ?? lastCitySlug ?? undefined;

  function goToService() {
    if (effectiveCitySlug) {
      router.push(`/${effectiveCitySlug}/service/${service.slug}`);
    } else {
      openCitySelector((selectedCitySlug) => {
        router.push(`/${selectedCitySlug}/service/${service.slug}`);
      });
    }
  }

  function handleAddToCart() {
    if (effectiveCitySlug) {
      addToCart(service.id, effectiveCitySlug);
    } else {
      openCitySelector((selectedCitySlug) => addToCart(service.id, selectedCitySlug));
    }
  }

  const href = effectiveCitySlug ? `/${effectiveCitySlug}/service/${service.slug}` : undefined;

  const imageEl = image ? (
    // eslint-disable-next-line @next/next/no-img-element -- generated illustration asset (scripts/gen_illustrations.mjs), mock-data phase
    <img
      src={image}
      alt=""
      loading="lazy"
      decoding="async"
      className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  ) : (
    <div className="flex aspect-[4/3] w-full items-center justify-center bg-neutral-100 text-neutral-400">
      <Icon name="wrench" className="h-8 w-8" />
    </div>
  );

  return (
    <div className="group flex h-full w-full flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {href ? (
        <Link href={href} aria-label={service.name} className="block overflow-hidden">
          {imageEl}
        </Link>
      ) : (
        <button
          type="button"
          onClick={goToService}
          aria-label={service.name}
          className="block overflow-hidden text-left"
        >
          {imageEl}
        </button>
      )}
      <div className="flex flex-1 flex-col p-4">
        {href ? (
          <Link href={href}>
            <h3 className="text-sm font-bold leading-snug text-neutral-900 hover:text-brand-700">
              {service.name}
            </h3>
          </Link>
        ) : (
          <button type="button" onClick={goToService} className="text-left">
            <h3 className="text-sm font-bold leading-snug text-neutral-900 hover:text-brand-700">
              {service.name}
            </h3>
          </button>
        )}
        <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{service.shortDescription}</p>

        {/*
          Phase 3 final visual-audit pass: the star rating + review count
          used to render here from Service.ratingAverage/ratingCount, but
          those are placeholder mock values, not confirmed real customer
          reviews — displaying a specific number like "4.9 (1280)" reads as
          a genuine business claim of real review volume, which this phase
          can't support. The fields/types/data are left completely intact
          (real ratings can be wired back in here the moment real review
          data exists) — this only stops rendering them.
        */}

        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-lg font-extrabold text-neutral-900">
              {formatINR(service.offerPrice)}
            </span>
            {service.discountPercent > 0 && (
              <span className="text-xs text-neutral-500 line-through">{formatINR(service.mrp)}</span>
            )}
            {service.discountPercent > 0 && (
              <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-700">
                {service.discountPercent}% off
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-3 w-full rounded-lg border border-brand-600 px-3 py-2.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-600 hover:text-white"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

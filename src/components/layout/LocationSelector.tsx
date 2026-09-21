"use client";

import { useParams } from "next/navigation";
import { useLocation } from "@/lib/state/LocationProvider";
import { getCityBySlugSync } from "@/lib/data/cities";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Header location control (Phase 3 header/footer revision §5) — now a
 * first-class `[pin] City ▾` pill rather than an icon-only button, shown at
 * every breakpoint (desktop center row and the mobile header's second row).
 * Opens the existing shared CitySelectorModal via LocationProvider; the
 * city shown comes from the current URL segment first (the real source of
 * truth, PHASE_2_SYSTEM_ARCHITECTURE.md §4), falling back to the
 * last-selected-city convenience value, then a neutral prompt. No second
 * city state is created here.
 */
export function LocationSelector({ className }: { className?: string }) {
  const params = useParams<{ city?: string }>();
  const { lastCitySlug, openCitySelector } = useLocation();

  const urlCitySlug = typeof params?.city === "string" ? params.city : undefined;
  const activeSlug = urlCitySlug ?? lastCitySlug ?? undefined;
  const activeCity = activeSlug ? getCityBySlugSync(activeSlug) : undefined;
  const label = activeCity ? `Location: ${activeCity.name}. Change city` : "Select your city";

  return (
    <button
      type="button"
      onClick={() => openCitySelector()}
      aria-label={label}
      title={label}
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
        className
      )}
    >
      <Icon name="map-pin" className="h-4 w-4 shrink-0 text-brand-600" />
      <span className="min-w-0 truncate">{activeCity ? activeCity.name : "Select city"}</span>
      <Icon name="chevron-down" className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
    </button>
  );
}

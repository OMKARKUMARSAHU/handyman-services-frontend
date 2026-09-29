"use client";

import { useState } from "react";

const FALLBACK_ICON_SRC = "/images/locations/fallback.svg";

/**
 * Data-driven landmark visual for a city/location card (LOCATION SELECTOR —
 * LANDMARK ICON SYSTEM phase). This is the only place that decides what
 * image to show for a city — no component elsewhere imports a specific
 * city's icon file directly, so a future Admin Panel only ever needs to
 * change `city.iconUrl` in the data layer for every card to pick it up.
 *
 * Fallback behavior:
 *  - `iconUrl` present  -> render it, with an onError escape hatch (same
 *    pattern as OfferBannerImage/HeroCollageImage) in case the uploaded
 *    asset URL is ever broken.
 *  - `iconUrl` missing/null (a city the Admin Panel hasn't assigned an icon
 *    to yet) -> render the shared neutral fallback illustration instead.
 * Either way something always renders — never a broken-image glyph, an
 * empty box, or "Coming soon" text, and the fallback preserves the same
 * layout/aspect so swapping in a real icon later never reflows the grid.
 */
export function LocationIcon({
  iconUrl,
  iconAlt,
  decorative = true,
  className = "h-10 w-10",
}: {
  iconUrl?: string | null;
  /** Accessible description of the icon. Ignored when `decorative` is true. */
  iconAlt?: string | null;
  /**
   * True when the city name is already visible right next to this icon
   * (the normal case in every location card) — the icon then carries no
   * information of its own and gets `alt=""` so screen readers don't
   * announce it twice. Set to false only if this icon is ever used with no
   * adjacent visible name.
   */
  decorative?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = !iconUrl || failed ? FALLBACK_ICON_SRC : iconUrl;
  const alt = decorative ? "" : (iconAlt ?? "");

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data-driven mock/uploaded location asset, not a static import
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-contain ${className}`}
    />
  );
}

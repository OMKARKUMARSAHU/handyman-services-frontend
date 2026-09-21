"use client";

import { useState } from "react";

/**
 * Defensive `onError` fallback for the Spotlight banner image (Phase 3
 * final-polish pass, item 2). The root cause of the broken-image icon the
 * client's screenshot caught was an invalid banner SVG (an unescaped "&"
 * in "Water & Air Purifiers" — fixed in scripts/gen_banners.py), but the
 * image itself needs its own client-side escape hatch too: if any banner
 * image ever fails to load for any reason, this unmounts the `<img>`
 * rather than leaving the browser's native broken-image glyph on screen —
 * the always-present gradient background and offer text in
 * SpotlightBanners.tsx underneath are enough on their own, so the card
 * still reads as intentional, not broken.
 */
export function OfferBannerImage({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- generated banner asset (scripts/gen_banners.py), mock-data phase
    <img
      src={src}
      alt=""
      loading="eager"
      decoding="sync"
      onError={() => setFailed(true)}
      className={
        className ??
        "absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      }
    />
  );
}

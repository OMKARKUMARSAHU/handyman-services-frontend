"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";

/**
 * One tile of the hero's photographic collage (Phase 3 "major homepage
 * visual rework" pass, item 3/4/6) — same defensive `onError` pattern as
 * `OfferBannerImage.tsx`: if `src` ever fails to load, this unmounts the
 * `<img>` and falls back to a clean neutral panel with an icon instead of
 * leaving the browser's native broken-image glyph on screen. `src` today
 * points at a generated placeholder-style illustration (see
 * `scripts/gen_hero_scenes.mjs`'s doc comment for why — this environment
 * cannot safely fetch real stock photography); swapping in a real
 * photograph later is a one-line `src` change here, no layout change.
 */
export function HeroCollageImage({
  src,
  alt,
  fallbackIcon,
  className,
}: {
  src: string;
  alt: string;
  fallbackIcon: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-neutral-100 text-neutral-400 ${className ?? ""}`}
      >
        <Icon name={fallbackIcon} className="h-8 w-8" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- generated placeholder-style illustration (scripts/gen_hero_scenes.mjs), ready to be swapped for a real photo
    <img
      src={src}
      alt={alt}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ""}`}
    />
  );
}

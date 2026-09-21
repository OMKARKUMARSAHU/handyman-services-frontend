"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";

/**
 * A single reusable image slot for a person/profile-type photo (Phase 3
 * "major homepage visual rework" pass, item 18 — a client-requested
 * profile visual with no image file or identity supplied yet). Same
 * graceful `onError` fallback pattern as `OfferBannerImage`/
 * `HeroCollageImage`: `src` points at a path no file exists at yet, so it
 * 404s and this quietly falls back to a clean neutral panel with a generic
 * person icon — never a broken-image glyph, and never an invented photo or
 * name standing in for a real person. The moment a real photo is supplied
 * at `src`, it renders automatically with no component change — same
 * "drop a file, set the path" pattern used for every other image slot in
 * this project (see PHASE_4_FRONTEND_POLISH_REPORT.md §7/§15).
 */
export function ProfileImageSlot({
  src,
  alt,
  exists,
  className,
}: {
  src: string;
  alt: string;
  /**
   * Whether `src` is known (server-side, via `fs.existsSync` on the public
   * asset — see about/page.tsx) to exist before this ever reaches the
   * browser. A plain client-side `onError` fallback has a real race
   * against React hydration: if the image request 404s before hydration
   * finishes attaching the error handler, the browser's native
   * broken-image glyph can render and never get swapped out — caught by
   * this exact case (`founder.jpg` intentionally doesn't exist yet) during
   * this round's verification sweep. Checking existence server-side, where
   * it's just a filesystem fact for a static public asset, avoids the race
   * entirely: the fallback is what gets server-rendered in the first
   * place, nothing to "swap" client-side. `onError` below stays as a
   * second line of defense for a file that exists at build time but still
   * fails to load at runtime.
   */
  exists: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(!exists);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-neutral-100 text-neutral-400 ${className ?? ""}`}
      >
        <Icon name="user" className="h-10 w-10" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- optional client-supplied photo slot, no file exists yet (falls back on 404)
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

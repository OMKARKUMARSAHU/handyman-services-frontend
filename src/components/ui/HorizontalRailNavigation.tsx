"use client";

import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * EDGE ARROW NAVIGATION phase — replaces `HorizontalScrollIndicator`. The
 * client explicitly rejected the scrollbar/progress-slider UI and asked for
 * contextual edge arrow navigation instead: circular white chevron buttons
 * at the rail's edges, matching the pattern already proven in
 * VideoCurationGallery.tsx, generalized into one shared component used by
 * every horizontal rail in the app and shown at *every* breakpoint
 * (including mobile) rather than `sm:`-and-up only.
 *
 * Each side is a real `<button>`, never a disabled one — when a direction
 * can't scroll further, that side's button is omitted from the DOM
 * entirely (not just visually hidden or `disabled`), so it's never a focus
 * stop and never intercepts a touch/swipe gesture at that edge. The whole
 * component renders nothing when neither direction can scroll (content
 * fits, or the rail has become a static grid at a wider breakpoint).
 *
 * Positioning is intentionally responsive rather than a single fixed
 * offset: on mobile several rails bleed edge-to-edge (`-mx-4`/`px-4`) to
 * show a peeking next card, so a button placed *outside* the rail's own
 * box there would sit off-screen and cause exactly the page overflow the
 * brief calls out to avoid. A small positive inset (`left-1`/`right-1`)
 * keeps the button fully on-screen at every rail's narrowest width. At
 * `sm:` and up the rail sits inside the page's normal Container padding
 * again, so the button can sit just outside the rail's edge
 * (`-left-3`/`-right-3`) exactly like the existing, already-shipped
 * VideoCurationGallery precedent, with room to spare in the gutter.
 */
export function HorizontalRailNavigation({
  canScrollLeft,
  canScrollRight,
  onScrollLeft,
  onScrollRight,
  label,
  tone = "neutral",
}: {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  onScrollLeft: () => void;
  onScrollRight: () => void;
  /** Used to build each button's aria-label, e.g. "New & Noteworthy". */
  label: string;
  /**
   * "neutral" (default) is for the app's normal white/neutral-50 sections.
   * "inverted" is for a rail on a dark background (e.g. the Video
   * Curations section's `bg-neutral-950` band) — a slightly stronger ring
   * and a lighter focus-outline shade so a white circular button reads
   * clearly against a dark section, matching the tone distinction the old
   * indicator made.
   */
  tone?: "neutral" | "inverted";
}) {
  if (!canScrollLeft && !canScrollRight) return null;

  const buttonClass = cn(
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-800 shadow-lg ring-1 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-10 sm:w-10",
    tone === "inverted"
      ? "ring-black/10 focus-visible:outline-brand-400"
      : "ring-black/5 focus-visible:outline-brand-500"
  );

  return (
    <>
      {canScrollLeft && (
        <button
          type="button"
          onClick={onScrollLeft}
          aria-label={`Scroll ${label} left`}
          className={cn(buttonClass, "left-1 sm:-left-3")}
        >
          <Icon name="chevron-left" className="h-5 w-5" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={onScrollRight}
          aria-label={`Scroll ${label} right`}
          className={cn(buttonClass, "right-1 sm:-right-3")}
        >
          <Icon name="chevron-right" className="h-5 w-5" />
        </button>
      )}
    </>
  );
}

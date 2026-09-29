"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * HORIZONTAL RAIL SCROLL INDICATOR — GLOBAL UX FIX phase.
 *
 * One reusable hook that turns any horizontally-scrollable container into
 * the data a `HorizontalScrollIndicator` needs to render — no rail
 * implements its own scroll-tracking logic. Attach the returned `ref` to
 * the actual `overflow-x-auto` element (the same element the rail already
 * scrolls), render `<HorizontalScrollIndicator state={state} />` right
 * after it, and nothing else changes about how the rail scrolls.
 *
 * Behavior:
 *  - `hasOverflow` is derived from real `scrollWidth`/`clientWidth`, never
 *    a hardcoded breakpoint — a rail that becomes a static grid at `sm:`
 *    (SpotlightBanners, TestimonialCarousel, TrustStrip) naturally reports
 *    `hasOverflow: false` there with no special-casing needed here.
 *  - `thumbLeftPct`/`thumbWidthPct` are recomputed from `scrollLeft` /
 *    `scrollWidth` / `clientWidth` on every scroll event (covers touch,
 *    trackpad, mouse wheel, drag-scroll, and a rail's own
 *    `element.scrollBy(...)` arrow-button calls — all of them fire the same
 *    native `scroll` event, so nothing needs to know which input caused
 *    the movement) and on resize (covers viewport changes and the
 *    container's own size changing).
 *  - `recomputeKey` lets a caller force a re-measure when the *content*
 *    changes without the container's own box necessarily resizing (e.g. the
 *    number of cards changes after a city/category switch) — pass
 *    something like `items.length` or a joined list of ids.
 *
 * Deliberately NOT draggable (see HorizontalScrollIndicator's doc comment)
 * — this hook only ever reads scroll state, it never writes to
 * `scrollLeft`, so the underlying rail's own touch/trackpad/mouse
 * scrolling is completely unaffected by adding this.
 */

export interface HorizontalScrollState {
  hasOverflow: boolean;
  /** Left edge of the thumb, as a percentage of the track's width (0–100). */
  thumbLeftPct: number;
  /** Width of the thumb, as a percentage of the track's width (0–100). */
  thumbWidthPct: number;
}

const NO_OVERFLOW_STATE: HorizontalScrollState = {
  hasOverflow: false,
  thumbLeftPct: 0,
  thumbWidthPct: 100,
};

// Sensible bounds (per the brief) so the thumb never becomes an
// unusably-thin sliver with many cards, or an almost-full track that reads
// as "nothing to scroll" when only slightly overflowing.
const MIN_THUMB_PCT = 12;
const MAX_THUMB_PCT = 90;

// Below this many px of actual extra scroll room, treat it as "fits" —
// guards against 1px sub-pixel-rounding overflow reporting a phantom
// scrollbar that can never visibly move.
const OVERFLOW_TOLERANCE_PX = 2;

export function useHorizontalScrollIndicator<T extends HTMLElement>(recomputeKey?: unknown) {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState<HorizontalScrollState>(NO_OVERFLOW_STATE);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const { scrollWidth, clientWidth, scrollLeft } = el;
    const maxScroll = scrollWidth - clientWidth;

    if (maxScroll <= OVERFLOW_TOLERANCE_PX) {
      setState((prev) => (prev.hasOverflow ? NO_OVERFLOW_STATE : prev));
      return;
    }

    const visibleRatio = clientWidth / scrollWidth;
    const thumbWidthPct = Math.min(MAX_THUMB_PCT, Math.max(MIN_THUMB_PCT, visibleRatio * 100));
    const progress = Math.min(1, Math.max(0, scrollLeft / maxScroll));
    const thumbLeftPct = progress * (100 - thumbWidthPct);

    setState((prev) => {
      if (
        prev.hasOverflow &&
        Math.abs(prev.thumbLeftPct - thumbLeftPct) < 0.15 &&
        Math.abs(prev.thumbWidthPct - thumbWidthPct) < 0.15
      ) {
        return prev; // imperceptible change — skip the re-render
      }
      return { hasOverflow: true, thumbLeftPct, thumbWidthPct };
    });
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      measure();
    });
  }, [measure]);

  // Mount-once: wire up listeners on whatever element `ref` is attached to.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    measure();

    el.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);

    // Catches the container's own box changing (sidebar collapse, viewport
    // resize at a breakpoint, orientation change) — a superset of the
    // window resize listener above, kept for non-window-driven resizes.
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      resizeObserver.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-measure whenever the caller signals the *content* changed (item
  // count, filtered list, etc.) — a ResizeObserver on the scroll container
  // does not fire just because scrollWidth grew while clientWidth stayed
  // the same, so this covers dynamic content the box-resize listeners miss.
  useEffect(() => {
    measure();
  }, [recomputeKey, measure]);

  return { ref, state };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * EDGE ARROW NAVIGATION phase — replaces the old
 * `useHorizontalScrollIndicator` slider-tracking hook. The client rejected
 * the scrollbar/progress-slider UI outright and asked for contextual edge
 * arrow buttons instead; this hook keeps the same proven measurement
 * strategy (real `scrollLeft`/`scrollWidth`/`clientWidth` reads, a passive
 * `scroll` listener, a `window resize` listener, a `ResizeObserver` on the
 * container itself, and an optional `recomputeKey` for content changes that
 * don't resize the box) but derives the two booleans an edge-arrow pair
 * actually needs instead of a thumb position, and adds the two callbacks
 * that move the rail.
 *
 * Visibility logic (per the brief):
 *  - No overflow at all (`scrollWidth - clientWidth <= tolerance`): both
 *    `false` — a rail that becomes a static grid at `sm:` (SpotlightBanners,
 *    TestimonialCarousel, TrustStrip) naturally reports both `false` there
 *    with no special-casing needed here.
 *  - At the start (`scrollLeft <= tolerance`): `canScrollLeft` false,
 *    `canScrollRight` true.
 *  - In the middle: both true.
 *  - At the end (`scrollLeft >= maxScroll - tolerance`): `canScrollRight`
 *    false, `canScrollLeft` true.
 *
 * `onScrollLeft`/`onScrollRight` scroll by ~90% of the container's own
 * current visible width (never a hardcoded pixel value), smoothly, so the
 * distance scales naturally with card size and viewport width.
 *
 * Deliberately never writes to `scrollLeft` except in direct response to
 * the caller invoking `onScrollLeft`/`onScrollRight` — native touch,
 * trackpad, mouse-wheel, and drag scrolling on the underlying rail are
 * completely unaffected by adding this hook.
 */

export interface HorizontalRailScrollState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

const NO_OVERFLOW_STATE: HorizontalRailScrollState = {
  canScrollLeft: false,
  canScrollRight: false,
};

// Below this many px of actual extra scroll room, or this close to an edge,
// treat it as "fits" / "at the edge". This is deliberately larger than a
// bare sub-pixel-rounding guard: several rails bleed edge-to-edge on mobile
// (`-mx-4` + `px-4`, so the browser can show a peeking next card) and use
// `snap-x snap-mandatory` on their children — on that combination, this
// container's genuine resting `scrollLeft` at the very first card is the
// container's own left padding (16px here), not 0, because scroll-snap
// resolves its snap area against the padding box. Without this margin the
// left arrow would spuriously appear the instant the page loads, before
// the user has scrolled at all. 20px comfortably absorbs that CSS
// artifact while staying far smaller than any real scroll movement (an
// arrow press moves the rail by `SCROLL_STEP_RATIO` of its own width).
const OVERFLOW_TOLERANCE_PX = 20;

// How far one arrow press moves the rail, as a fraction of the container's
// own visible width — container-relative, never a fixed pixel count.
const SCROLL_STEP_RATIO = 0.9;

export function useHorizontalRailScroll<T extends HTMLElement>(recomputeKey?: unknown) {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState<HorizontalRailScrollState>(NO_OVERFLOW_STATE);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const { scrollWidth, clientWidth, scrollLeft } = el;
    const maxScroll = scrollWidth - clientWidth;

    if (maxScroll <= OVERFLOW_TOLERANCE_PX) {
      setState((prev) => (prev.canScrollLeft || prev.canScrollRight ? NO_OVERFLOW_STATE : prev));
      return;
    }

    const canScrollLeft = scrollLeft > OVERFLOW_TOLERANCE_PX;
    const canScrollRight = scrollLeft < maxScroll - OVERFLOW_TOLERANCE_PX;

    setState((prev) =>
      prev.canScrollLeft === canScrollLeft && prev.canScrollRight === canScrollRight
        ? prev
        : { canScrollLeft, canScrollRight }
    );
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

  const onScrollLeft = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: -el.clientWidth * SCROLL_STEP_RATIO, behavior: "smooth" });
  }, []);

  const onScrollRight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * SCROLL_STEP_RATIO, behavior: "smooth" });
  }, []);

  return {
    ref,
    canScrollLeft: state.canScrollLeft,
    canScrollRight: state.canScrollRight,
    onScrollLeft,
    onScrollRight,
  };
}

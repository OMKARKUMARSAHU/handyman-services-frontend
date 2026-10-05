# Phase: Horizontal Rail Scroll Indicator — Global UX Fix

> **⚠️ Superseded.** The client rejected the horizontal scrollbar/progress indicator described in this document. It was replaced with contextual edge arrow navigation. See `PHASE_EDGE_ARROW_NAVIGATION.md` for the current system; the files described below (`useHorizontalScrollIndicator.ts`, `HorizontalScrollIndicator.tsx`) have been deleted and no longer exist in the codebase. This document is kept for historical context only.

Local frontend UX correction only. No git add/commit/push, no Vercel deploy — this phase stops after implementation and QA, per the brief's own explicit stop rule. The approved GitHub commit (`3f0100f`, "Finalize Handyman marketplace frontend") remains the baseline; nothing here has been staged, committed, or pushed.

## 1. Why this was added

Several horizontal card rails across the site (New & Noteworthy, Featured Services, category rails, promotional banners, video curations, the service-photo thumbnail strip) scroll sideways but gave no visual hint that there was more content off-screen — a first-time visitor could easily miss cards sitting just past the right edge. This phase audits every horizontal-scroll container in the frontend and adds a thin, low-contrast track-and-thumb indicator directly below each one that scrolls, so the thumb's position and width always reflect exactly how much content is visible and where the user currently is within it.

## 2. Audit: every horizontal-scroll container found

A full-repo search for `overflow-x-auto` / `overflow-x-scroll` inside `src/components` found exactly 6 real horizontal-scroll rails (a 7th match, a doc-comment sentence in `VideoCurationModal.tsx` that merely *mentions* "overflow-x-auto" in prose, was confirmed to be a false positive — that file has no scrolling container of its own):

| # | Component | Rail | Rendered on |
|---|---|---|---|
| 1 | `src/components/catalog/ServiceRail.tsx` | New & Noteworthy, Featured Services, and every per-category rail (Consumer Durables, Kitchen Appliances, Water & Air Purifiers, …) | City homepage (`/[city]`), via `HomeDiscoveryRails` |
| 2 | `src/components/home/SpotlightBanners.tsx` | "Offers you don't want to miss" promo rail | City homepage |
| 3 | `src/components/home/TrustStrip.tsx` | "Why choose us" trust/stat strip | City homepage |
| 4 | `src/components/home/VideoCurationGallery.tsx` | Video curations ("Real service visits, on video") | City homepage |
| 5 | `src/components/service/ServiceGallery.tsx` | Photo thumbnail strip | Service detail page (`/[city]/service/[slug]`) |
| 6 | `src/components/home/TestimonialCarousel.tsx` | Customer testimonials | Not currently mounted anywhere — see note below |

**Note on `TestimonialCarousel`:** an earlier phase (Phase 4 homepage revisions) intentionally removed testimonials from both homepages because the underlying quotes were mock/placeholder data and showing them as real customer evidence was judged misleading. The component and its data were deliberately *kept, unused* rather than deleted, in case real testimonials are added later (see the doc comment in `src/app/page.tsx`). This phase wired the same hook/indicator into it for consistency — so it's ready the moment it's remounted — and confirmed it via `tsc`/`lint`/`build`, but it could not be exercised in a live browser QA pass since no route currently renders it.

**Explicitly NOT touched, because they don't horizontally scroll:**
- `PopularCityGrid.tsx` / `CityList.tsx` (Location Icon phase) — the Popular Cities grid is a responsive `grid-cols-3 sm:grid-cols-4` layout, not a scroll container, and Other Cities is a vertical list. Per the brief's own carve-out, no indicator was forced onto either; if a location rail is ever converted to horizontal scrolling later, the same hook/component can be dropped in then.
- `CategoryGrid.tsx`, `ProductGrid.tsx` — static responsive grids, no overflow.
- Homepage hero, header, footer, cart, checkout, login/profile — untouched per the brief's "DO NOT REDESIGN" list; none of these scroll horizontally in the first place.

## 3. Reusable component/hook

One hook + one presentational component, used identically by all 6 rails — no rail has its own bespoke scroll-tracking logic.

**`src/lib/hooks/useHorizontalScrollIndicator.ts`** — `useHorizontalScrollIndicator<T extends HTMLElement>(recomputeKey?: unknown)`. Returns `{ ref, state }`. The caller attaches `ref` to the same element it already scrolls (the `overflow-x-auto` div); the hook does not introduce a second scroll element or a second source of truth. `state` is `{ hasOverflow, thumbLeftPct, thumbWidthPct }`.

**`src/components/ui/HorizontalScrollIndicator.tsx`** — `<HorizontalScrollIndicator state={state} tone="neutral" | "inverted" />`. Renders the track+thumb `<div>`s from `state`, or `null` when `state.hasOverflow` is `false`. `tone="inverted"` is used only for the Video Curations rail's dark (`bg-neutral-950`) section, reusing the same white/opacity convention already established by that section's own `VideoCurationModal.tsx` progress bar, instead of a barely-visible dark-on-dark track.

## 4. Scroll-position calculation

Entirely derived from the real DOM, never a hardcoded percentage, card count, or card width:

```
maxScroll = scrollWidth - clientWidth
hasOverflow = maxScroll > OVERFLOW_TOLERANCE_PX   // 2px tolerance for sub-pixel rounding
progress = clamp(scrollLeft / maxScroll, 0, 1)
thumbLeftPct = progress * (100 - thumbWidthPct)
```

When `maxScroll <= 2px` the hook reports `hasOverflow: false` and the indicator doesn't render at all — this is what makes rails that fit entirely on screen (a category with only 2–3 cards, or any rail at a wide desktop width) correctly show no indicator, with no special-casing anywhere.

Recomputation is driven by:
- a **passive `scroll` listener** on the container — fires identically whether the movement came from touch/swipe, trackpad, mouse wheel, a manual drag-scroll, or a rail's own `element.scrollBy({ behavior: "smooth" })` arrow-button call, so every input source stays in sync for free;
- a **`ResizeObserver`** on the container, for viewport/breakpoint changes and container-box resizes;
- a **`window resize`** listener, as a second net for resizes the `ResizeObserver` might not fire for;
- an optional **`recomputeKey`** effect — pass something like `items.length` or a joined list of ids so the hook re-measures when the *content* changes without the container's own box necessarily changing size (a `ResizeObserver` alone won't fire just because `scrollWidth` grew while `clientWidth` stayed the same).

All measurement work inside the `scroll`/`resize` paths is throttled through a single `requestAnimationFrame` call (`scheduleMeasure`), and `setState` is skipped entirely when the new thumb position/width would move by less than 0.15% — so a continuous scroll gesture doesn't force a React re-render on every pixel.

## 5. Thumb sizing logic

```
visibleRatio = clientWidth / scrollWidth
thumbWidthPct = clamp(visibleRatio * 100, MIN_THUMB_PCT, MAX_THUMB_PCT)   // 12–90%
```

The 12–90% bounds keep the thumb from ever becoming an unusably thin sliver on a rail with many small cards, or reading as "nothing to scroll" when a rail only barely overflows.

## 6. Responsive behavior

The indicator's visibility is a pure function of live overflow, so it automatically adapts at every breakpoint with zero rail-specific logic:
- **`SpotlightBanners`, `TrustStrip`** switch from a horizontal-scroll row on mobile to a static `sm:grid` layout at `sm:` (≥640px) and up. At those widths `scrollWidth === clientWidth`, so `hasOverflow` is `false` and the indicator disappears — confirmed explicitly in QA (section 8).
- **`ServiceRail`, `VideoCurationGallery`, `ServiceGallery`** keep scrolling at every width tested (1440 down to 360px) whenever there are enough cards to overflow, so the indicator stays visible and tracks scroll position at all of them.
- **`TestimonialCarousel`** shares the same `sm:grid` pattern as `TrustStrip`/`SpotlightBanners` in its markup, so it would behave the same way if it were ever mounted on a page again.

## 7. Accessibility behavior

The indicator bar itself is `aria-hidden="true"` and not keyboard-focusable — deliberate, not an oversight. The brief explicitly allows a synchronized-visual-only indicator (non-draggable) when a draggable thumb would introduce "unnecessary complexity or accessibility problems," and that trade-off clearly favors simplicity here: the same component is reused across six rails with very different card sizes and layouts, and a single drag-implementation robust enough for all of them — plus the keyboard interaction and `role="slider"` semantics a truly interactive thumb would require — is a large surface for what is a purely discoverability affordance. It conveys no information a sighted, mouse/touch-using visitor isn't already getting by looking at the rail's own scroll position, and a screen-reader user gets the equivalent "there's more here" signal from the rail's existing `role="region"` + descriptive `aria-label` and normal DOM order — so marking it `aria-hidden` avoids a screen reader announcing a meaningless decorative bar, per the brief's own "do not make a decorative indicator unnecessarily keyboard-focusable" instruction.

The rail itself is completely unaffected: the hook only ever *reads* `scrollLeft`/`scrollWidth`/`clientWidth`, it never writes to them, so every existing scroll mechanism (touch, trackpad, mouse wheel, drag, arrow buttons, keyboard-focus + arrow-key scroll where already supported) keeps working exactly as before.

One incidental accessibility improvement made while wiring `ServiceGallery.tsx`: its thumbnail strip previously had no `role`/`aria-label` at all; it now has `role="region"` and `aria-label="<service name> — photo thumbnails, scrollable list"`, matching the convention every other rail in the app already used, which also made it identifiable for QA.

axe-core (`wcag2a`, `wcag2aa`, `best-practice`) was run on every page/width combination in this QA pass: **0 violations** in every run.

## 8. QA results

**Static checks**
- `npx tsc --noEmit` — 0 errors
- `npm run lint` — 0 errors, 0 warnings
- `npm run build` — 494/494 pages built successfully
- Fresh `next start -p 3000` server confirmed serving the latest build (verified via the start log and `curl` 200 on `/`, `/ranchi`, `/ranchi/service/air-conditioner-installation`) before browser QA began.

**Browser QA (Playwright, Chromium)** — two passes, **171 checks total, 171 passed, 0 failed**, across all 6 required widths (1440, 1280, 1024, 390, 375, 360):

*Pass 1 (129 checks)* — `/ranchi` and `/ranchi/service/air-conditioner-installation`:
- No page-level horizontal overflow, before or after a resize round-trip, at every width.
- Every `role="region"` scroll container found (≥4 per page) whose real `scrollWidth − clientWidth` exceeds 2px correctly reports overflow.
- **New & Noteworthy rail**: indicator visibility matches real overflow at every width; thumb starts near the left edge (<3%) on load; reaches the right edge (`left + width > 96%`) after a programmatic scroll-to-end; sits mid-track (10–85%) when scrolled to the middle; resets correctly.
- **Video Curations rail**: arrow buttons visible at ≥640px; clicking the right arrow moves the thumb (verified via a before/after comparison across the smooth-scroll animation).
- **Mobile widths (390/375/360)**: a drag-based swipe simulation on the New & Noteworthy rail confirms the underlying scroll still responds to a touch-style gesture — the indicator adds nothing that blocks or intercepts it.
- **ServiceGallery thumbnail rail** on the service detail page: indicator visibility matches real overflow.
- axe-core: 0 violations at every width. No console errors. No failed/4xx/5xx network requests.

*Pass 2 (42 checks, added to close remaining gaps)*:
- **Featured Services rail** (a second, distinct `ServiceRail` instance): indicator visibility matches overflow at every width.
- **A category rail** (Consumer Durables `ServiceRail` instance): indicator visibility matches overflow at every width.
- **Explicit `sm:`+ disappearance**: at every width ≥640px, `TrustStrip` and `SpotlightBanners` were confirmed to have `scrollWidth === clientWidth` (their `sm:grid` layout has genuinely taken over) *and* their indicators confirmed not visible — not just inferred from the layout class.
- **Resize-recompute**: for the New & Noteworthy rail, the thumb's width was read, the viewport was shrunk by ~40%, and the thumb's width was re-read — confirming the hook actually recomputes the thumb's size on a real resize event rather than leaving a stale value.
- A second axe-core pass and console-error check at every width — again 0 violations, 0 errors.

One bug was found and fixed *in the QA script itself* during this work — not in the shipped code: an early version of the Video-Curation arrow-button check used too broad a `[aria-hidden="true"]` selector, which matched the first decorative play-button icon inside a video card (icons are also `aria-hidden="true"`) instead of the indicator bar. Narrowing the selector to `div[aria-hidden="true"]` (icons render as `<svg>`, the indicator as a `<div>`) fixed the false failure; no application code changed as a result.

**Files changed:**
- `src/lib/hooks/useHorizontalScrollIndicator.ts` (new)
- `src/components/ui/HorizontalScrollIndicator.tsx` (new)
- `src/components/catalog/ServiceRail.tsx`
- `src/components/home/SpotlightBanners.tsx`
- `src/components/home/TestimonialCarousel.tsx`
- `src/components/home/TrustStrip.tsx`
- `src/components/home/VideoCurationGallery.tsx`
- `src/components/service/ServiceGallery.tsx`

Nothing in the "DO NOT REDESIGN" list (homepage/header/footer/location selector/cart/checkout/login/service cards/pricing/typography/colors/overall layout, business logic, service/pricing/city data, Admin-Panel architecture, or the Location Icon system from the previous phase) was touched.

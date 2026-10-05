# Phase: Edge Arrow Navigation — Replaces the Horizontal Scroll Indicator

Local frontend UX correction only, for client review. **No git add/commit/push, no Vercel deploy** — this phase stops after implementation and QA, per the brief's own explicit stop rule. The last approved-and-pushed commit (`9b69aae`, "Finalize location landmarks and horizontal rail UX") remains the baseline on GitHub; nothing in this phase has been staged, committed, or pushed.

## 1. Why this was done

**Client rejected the horizontal scrollbar/progress indicator.** The thin track-and-thumb bar shipped in the previous phase (`PHASE_HORIZONTAL_RAIL_SCROLL_INDICATOR.md`, committed in `9b69aae`) was explicitly rejected in client feedback. It has been replaced with **contextual edge arrow navigation**: circular white chevron buttons that appear at the left and/or right edge of a rail only when there is more content to scroll to in that direction.

**State-behavior spec (implemented exactly as specified):**

| Rail state | Left arrow | Right arrow |
|---|---|---|
| At the start (no content scrolled past) | Hidden | Visible |
| In the middle (content on both sides) | Visible | Visible |
| At the end (no more content to the right) | Visible | Hidden |
| No overflow (all content already fits) | Hidden | Hidden |

"Hidden" means removed from the DOM entirely — not `display: none`, not `disabled` — so a hidden arrow is never a keyboard focus stop and never intercepts a touch/swipe gesture at that edge.

## 2. Audit: every horizontal-scroll container found

Re-ran the same repo-wide audit used for the previous phase (`overflow-x-auto` inside `src/components`) to confirm nothing changed since. Same 6 real horizontal-scroll rails, same 1 false positive (a doc-comment sentence in `VideoCurationModal.tsx` that only mentions "overflow-x-auto" in prose):

| # | Component | Rail | Rendered on |
|---|---|---|---|
| 1 | `src/components/catalog/ServiceRail.tsx` | New & Noteworthy ("Recently added services"), Featured Services, and every per-category rail (Consumer Durables, Kitchen Appliances, Water & Air Purifiers, …) | City homepage (`/[city]`) |
| 2 | `src/components/home/SpotlightBanners.tsx` | "Offers you don't want to miss" promo rail | City homepage |
| 3 | `src/components/home/TrustStrip.tsx` | "Why choose us" trust strip | City homepage |
| 4 | `src/components/home/VideoCurationGallery.tsx` | Video curations ("Real service visits, on video") | City homepage |
| 5 | `src/components/service/ServiceGallery.tsx` | Photo thumbnail strip | Service detail page (`/[city]/service/[slug]`) |
| 6 | `src/components/home/TestimonialCarousel.tsx` | Customer testimonials | Not currently mounted anywhere (see note) |

**Note on `TestimonialCarousel`:** still not mounted on any route (testimonials were removed from the homepage as mock/placeholder data in an earlier phase — see `src/app/page.tsx`'s doc comment). Wired into the new system for consistency and verified via `tsc`/`lint`/`build`, but not exercised in live browser QA since no route renders it — same caveat as the previous phase.

**Explicitly NOT touched, because they don't horizontally scroll — confirmed unchanged:**
- `PopularCityGrid.tsx` / `CityList.tsx` (Popular Cities grid, Other Cities list) — a responsive grid and a vertical list, not scroll containers. Verified by QA: opening the city selector modal shows zero edge-arrow buttons.
- `CategoryGrid.tsx`, `ProductGrid.tsx` — static responsive grids.
- Header, footer, cart, checkout, login/account — untouched; none of these scroll horizontally.
- The main service-image previous/next controls (`‹`/`›`) in `ServiceGallery.tsx` — a pre-existing, unrelated control for cycling the large image, left exactly as-is (still its own `aria-label="Previous photo"` / `"Next photo"`, still rendered, confirmed by QA).

## 3. Reusable hook + component

One hook + one presentational component, used identically by all 6 rails — no rail has its own bespoke scroll-tracking or button logic (the one rail that previously had bespoke arrow code, `VideoCurationGallery.tsx`, now uses the same shared pair as everything else).

**`src/lib/hooks/useHorizontalRailScroll.ts`** — `useHorizontalRailScroll<T extends HTMLElement>(recomputeKey?: unknown)`. Returns `{ ref, canScrollLeft, canScrollRight, onScrollLeft, onScrollRight }`.
- `ref` attaches to the same element the rail already scrolls (the `overflow-x-auto` div) — no second scroll element, no second source of truth.
- `canScrollLeft` / `canScrollRight` are derived from real `scrollLeft` / `scrollWidth` / `clientWidth`, recomputed on every native `scroll` event (passive listener — covers touch, trackpad, mouse wheel, and drag-scroll identically, since they all fire the same event), on `window resize`, on a `ResizeObserver` watching the container's own box, and on-demand via `recomputeKey` when the *content* changes without the box resizing (e.g. item count changes after a city/category switch).
- `onScrollLeft` / `onScrollRight` call `element.scrollBy({ left: ±clientWidth * 0.9, behavior: "smooth" })` — the distance is always 90% of the container's *own current* visible width, never a hardcoded pixel value or a card-count guess, so it scales correctly with card size and viewport.
- Tolerance: edges are detected with a 20px tolerance (see the constant's own doc comment in the file) rather than a bare sub-pixel guard. This is deliberate: several rails bleed edge-to-edge on mobile (`-mx-4` + `px-4`, so the next card visibly peeks in) and use CSS scroll-snap on their children; on that combination, the browser's genuine resting `scrollLeft` at the very first card is the container's own left padding (16px), not 0 — confirmed by direct measurement in Chromium. Without the wider tolerance, the left arrow would spuriously appear the instant the page loads, before the user has scrolled anything. 20px comfortably absorbs that CSS artifact while staying far smaller than any real scroll movement.
- Never writes to `scrollLeft` except in direct response to `onScrollLeft`/`onScrollRight` being called — native touch/trackpad/mouse-wheel/drag scrolling is completely unaffected by this hook.

**`src/components/ui/HorizontalRailNavigation.tsx`** — `<HorizontalRailNavigation canScrollLeft canScrollRight onScrollLeft onScrollRight label tone="neutral" | "inverted" />`.
- Renders real `<button type="button">` elements (not disabled, not `aria-disabled`) with `aria-label={"Scroll " + label + " left"/"right"}`.
- Each side is conditionally rendered — omitted from the DOM entirely, not just visually hidden — when that direction can't scroll.
- Circular, white, `shadow-lg`, `ring-1` — the same pattern already proven in the previous `VideoCurationGallery.tsx` implementation, generalized into one shared component and shown at **every** breakpoint (the old version was desktop-only, `hidden sm:flex`; the brief requires mobile arrow support too).
- Sized `h-9 w-9` (36px) below the `sm:` breakpoint and `h-10 w-10` (40px) at `sm:` and up — within the required 36–44px range at every width tested.
- Full keyboard support: a real `<button>` is natively focusable and activates on Enter/Space; `focus-visible:outline` is always present in the class list for a visible focus ring.
- `tone="inverted"` (used only by the Video Curations rail, which sits on a `bg-neutral-950` dark section) adjusts the ring and focus-outline color so a white button reads clearly against a dark background; the button itself stays solid white either way, matching the existing app convention for controls placed over photography/dark sections.
- **Positioning is responsive, not a single fixed offset** — see the component's own doc comment for the reasoning: on mobile, several rails bleed to the viewport edge (`-mx-4`), so a button placed *outside* the rail's own box there would sit off-screen and cause page overflow. The component uses a small positive inset (`left-1`/`right-1`, i.e. just inside the rail) below `sm:`, and the previous, already-proven outside offset (`-left-3`/`-right-3`) at `sm:` and up, where the page's normal Container padding gives it room. Verified with zero page-overflow failures at 390/375/360.

## 4. Wiring — all 6 rails, old system fully removed

Every rail that imported `HorizontalScrollIndicator` / `useHorizontalScrollIndicator` was updated to import `HorizontalRailNavigation` / `useHorizontalRailScroll` instead, and each scroll container now sits inside a `relative`-positioned wrapper so the arrows (`position: absolute`) anchor to the rail rather than the page:

- `src/components/catalog/ServiceRail.tsx`
- `src/components/home/SpotlightBanners.tsx`
- `src/components/home/TestimonialCarousel.tsx`
- `src/components/home/TrustStrip.tsx`
- `src/components/home/VideoCurationGallery.tsx` (also removed its own now-redundant bespoke `scrollByCards` helper and inline arrow-button markup, replacing both with the shared pair)
- `src/components/service/ServiceGallery.tsx` (thumbnail strip only — the separate main-image prev/next controls were left untouched)

**Old system deleted outright** (confirmed via a full-repo `grep` that zero files import them before deletion):
- `src/components/ui/HorizontalScrollIndicator.tsx`
- `src/lib/hooks/useHorizontalScrollIndicator.ts`

Both systems were never active at the same time in any rail — each rail's edit swapped the import, the hook call, and the rendered element in one pass.

## 5. Touch / swipe / trackpad / mouse-wheel scrolling — unaffected

The new hook only *reads* `scrollLeft`/`scrollWidth`/`clientWidth`; it never writes to them except inside `onScrollLeft`/`onScrollRight`, which only fire from an explicit arrow click or an Enter/Space key press on a focused arrow. Every rail's `overflow-x-auto` / `snap-x snap-mandatory` CSS is completely unchanged. Verified directly in QA: setting `scrollLeft` programmatically and dispatching a native `scroll` event (a proxy for a real touch/trackpad/wheel gesture) correctly updates which arrows are shown, on every rail, at every width.

## 6. QA

All 6 rails (`ServiceRail` ×3 instances — "Recently added services", "Featured Services", a per-category rail — `SpotlightBanners`, `TrustStrip`, `VideoCurationGallery`, `ServiceGallery`'s thumbnail strip) were exercised with a Playwright script across all 6 required widths (1440, 1280, 1024, 390, 375, 360), covering:

1. Rail/region present.
2. Old scrollbar/progress-indicator markup fully absent.
3. Right (or left) arrow, when present, is a real `<button>` element.
4. Arrow sized within 36–44px at that width.
5. At the true start of a rail: left arrow absent from the DOM, right arrow present.
6. Clicking the right arrow moves the rail (`scrollLeft` increases, container-width-relative distance).
7. After scrolling off the start: left arrow now present.
8. Keyboard: the arrow is focusable, and pressing Enter while it's focused scrolls the rail.
9. The arrow carries a visible-focus class (`focus-visible:outline`).
10. Native scroll (programmatic `scrollLeft` + dispatched `scroll` event, proxying touch/trackpad/wheel) correctly flips arrow visibility at the end of the rail.
11. A rail with no real overflow (the grid layouts `SpotlightBanners`/`TrustStrip`/`TestimonialCarousel` become at `sm:`+) renders zero arrows.
12. No page-level horizontal overflow at any width, including the narrowest (360px).
13. axe-core scan (`wcag2a`, `wcag2aa`, `best-practice`) = 0 violations, on both the homepage and a service detail page, at every width.
14. Zero browser console errors, zero failed/4xx/5xx network requests.
15. The city selector modal (Popular Cities grid, Other Cities list — non-scrolling by design) renders zero edge-arrow buttons; the service page's unrelated main-image prev/next controls remain present and untouched.

**Result: 528/528 checks passed across all 6 widths, 0 failures**, after one real fix found and applied during QA (see below).

**Issue found and fixed during QA:** the first mobile run (390/375/360) reported the left arrow already visible at the very start of every bleed-to-edge rail. Root-caused to a genuine browser behavior, not application logic: those rails use `-mx-4`/`px-4` (edge-to-edge bleed with a mobile "peek" affordance) together with `snap-x snap-mandatory`, and Chromium's scroll-snap resolves its snap area against the container's own padding box — so the true resting `scrollLeft` at the very first card is 16px (the padding value), not 0, confirmed by directly forcing `scrollLeft = 0` in the browser and observing it settle back to 16px on its own. Fixed by widening the hook's edge-detection tolerance from 2px to 20px (see §3) — comfortably absorbs this CSS artifact while remaining far smaller than any real scroll movement. Re-ran the full suite after the fix: 0 failures.

## 7. Build/lint/type-check

- `npx tsc --noEmit` — clean, 0 errors.
- `npm run lint` — clean, 0 errors, 0 warnings.
- `npm run build` — clean production build, all 494 static/SSG pages generated successfully.

## 8. Scope discipline

Per the brief: this phase touched only the 6 rails' scroll-affordance UI and the shared hook/component pair behind it. It did not touch: the Popular Cities grid or Other Cities list, product/category grids, the header, footer, cart, checkout, login, or account pages, the location-landmark icon system, or any git/deploy state. No `git add`/`commit`/`push` and no Vercel deploy were performed — this phase stops after implementation and QA, for client review.

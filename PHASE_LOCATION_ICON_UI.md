# PHASE — LOCATION SELECTOR: LANDMARK ICON SYSTEM

**Date:** 2026-09-29
**Scope:** A focused enhancement to the existing city/location selector only — give each city a recognizable landmark icon instead of plain text, in a way a future Admin Panel can manage without any frontend code change. No other part of the finalized frontend (homepage, footer, cart, checkout, login/profile, hamburger, service detail, pricing, catalog, business rules, city availability, or authentication) was touched.

---

## 1. Why this was added

The location selector (the `[pin] City ▾` control in the header, opening a shared city-picker modal) previously listed cities as plain text only. The client wants each city to be recognizable at a glance through a visual landmark, matching the general idea of a reference image of Indian-city line icons the client shared — icons for real, specific, recognizable monuments (India Gate, Gateway of India, Charminar, Hawa Mahal, and so on).

Per the client's own explicit instruction, that reference was used for the **general UX concept only** (an icon leading each city card, name readable underneath/beside it) — not as artwork to copy. None of the generated icons in this phase depict any specific real monument. Each city instead gets an original, generic glyph evoking its general character (see §6) in the same restrained visual language already used everywhere else in this app (`scripts/gen_illustrations.mjs`'s product icons: one brand-teal accent, a soft neutral circular badge, no per-item saturated color) — so the new icons read as part of the same product, not a second illustration style bolted on.

## 2. Data model changes

`City` (`src/types/index.ts`) gained two optional fields:

```ts
export interface City {
  id: string;
  name: string;
  state: string;
  slug: string;
  isPopular: boolean;
  active: boolean;
  sortOrder: number;
  iconUrl?: string | null;   // new
  iconAlt?: string | null;   // new
}
```

Both are optional so no existing code path, mock row, or future city added without an icon becomes invalid. Nothing else on `City` changed — `id`, `name`, `state`, `slug`, `isPopular`, `active`, `sortOrder` and the existing `getCities()` / `getCityBySlug()` / `getPopularCities()` / `getCityBySlugSync()` / `getAllCitiesSync()` DAL functions (`src/lib/data/cities.ts`) are untouched and unaffected — they already return whatever fields live on the `City` record, so `iconUrl`/`iconAlt` flow through automatically with zero DAL changes.

`src/data/cities.json` (all 8 existing mock cities — Ranchi, Delhi, Mumbai, Bengaluru, Jamshedpur, Patna, Pune, Kolkata) now carries an `iconUrl`/`iconAlt` pair each, pointing at the generated assets in §6. No city was added, removed, renamed, or had its `isPopular`/`active`/`sortOrder`/`state` changed — this phase does not touch city availability rules.

## 3. `iconUrl` / `iconAlt` behavior

No component imports a specific city's image file. Every location card renders through one new component, `LocationIcon` (`src/components/location/LocationIcon.tsx`), which is the **only** place that decides what image to show for a city:

- `iconUrl` present → render it.
- `iconUrl` missing/`null` → render the shared fallback illustration (§4).
- Either way, an `onError` handler (the same defensive pattern already used by `OfferBannerImage`/`HeroCollageImage` elsewhere in this app) swaps to the fallback if the given URL ever fails to actually load — so a broken/removed asset URL degrades to the fallback instead of a broken-image glyph.

This means the frontend genuinely "doesn't care where the image came from" (the client's own phrasing) — it just reads `iconUrl` off the data layer.

`iconAlt` is accepted but, by default, the icon is treated as **decorative** (`alt=""`) because the city name is always visible right next to it in both the popular grid and the other-cities list — screen readers would otherwise announce the city twice. `iconAlt` is there for a future case where an icon is ever shown with no adjacent visible name; `LocationIcon` takes a `decorative` prop to switch that behavior per call site.

## 4. Fallback behavior

`public/images/locations/fallback.svg` — a plain, generic map-pin glyph in the same visual system as every city icon — renders whenever a city has no `iconUrl` yet. It is never a broken image, an empty box, "Coming soon" text, or a random placeholder photo, and it occupies the exact same layout slot (same size, same circular badge) as a real icon, so the grid/list never reflows when a real icon is later assigned.

This was verified directly, not just by code review: a temporary local test set Ranchi's `iconUrl` to `null`, rebuilt, and confirmed in a real browser that the Ranchi card rendered the fallback glyph, the name stayed visible, and no console error or broken-image state occurred — then the mock data was reverted to its real, fully-populated state before this phase was considered done. (No shipped mock city is missing an icon; the fallback path exists and was proven to work for when a future city is.)

## 5. Location selector UX changes

Only two files render city cards, and only the cards themselves changed — the search, selection, and modal mechanics are untouched:

- `src/components/location/PopularCityGrid.tsx` — each popular city is now a card with the icon above the name (icon is the primary recognition element, name stays clearly readable underneath), in a responsive 3/4-column grid.
- `src/components/location/CityList.tsx` — each "Other Cities" row now leads with a smaller icon beside the name and state, in the existing vertical list (chosen over a grid here since this list is expected to hold more cities than the popular set and needs to stay scannable at any length, per the brief).
- `src/components/location/CitySelectorModal.tsx` — unchanged wiring (`useLocation()`, `getAllCitiesSync()`, popular/others split), except: (a) the scroll container's max-height was slightly increased (20rem → 26rem) to comfortably fit icon cards, and (b) search now also matches against `city.state` in addition to `city.name` — searching "Jharkhand" now additionally surfaces Ranchi and Jamshedpur, exactly the optional behavior the brief described, while a plain city-name search like "Ranchi" behaves exactly as before.

No second location/city state was introduced anywhere. Selecting a city still goes through the existing `useLocation().resolveCitySelection()` → `LocationProvider`, which remains the application's single source of truth for the selected city; `LocationSelector.tsx` (the header pill) and every `[city]`-scoped route were not touched.

## 6. Current mock assets

Nine new SVGs were generated by a new script, `scripts/gen_location_icons.mjs` (same code pattern as the existing `scripts/gen_illustrations.mjs`/`scripts/gen_hero_scenes.mjs` generators — a lucide-react icon rendered to static markup, composited onto the same restrained neutral-badge template), written to `public/images/locations/`:

| City | File | Glyph chosen (generic, not a specific monument) |
|---|---|---|
| Ranchi | `ranchi.svg` | Mountain — Jharkhand's hills/waterfalls |
| Delhi | `delhi.svg` | Landmark — a generic classical-monument glyph (capital city) |
| Mumbai | `mumbai.svg` | Ship — coastal financial capital |
| Bengaluru | `bengaluru.svg` | Tree — the "Garden City" |
| Jamshedpur | `jamshedpur.svg` | Factory — steel/industrial city |
| Patna | `patna.svg` | Waves — historic city on the Ganges |
| Pune | `pune.svg` | Building — education/IT hub |
| Kolkata | `kolkata.svg` | Anchor — historic river port city |
| *(fallback)* | `fallback.svg` | Map pin — neutral, used for any city with no icon yet |

Every file is a small (500–800 byte), inline-vector, single-accent-color SVG — no raster photography, nothing downloaded from the internet, nothing copied from Urban Company or the client's reference image. Re-running `node scripts/gen_location_icons.mjs` regenerates all nine deterministically.

## 7. Admin Panel future readiness

No Admin Panel or backend was built in this phase (out of scope, per the brief). The data model is shaped so that one, when built, only ever needs to write to `City.iconUrl` (and optionally `City.iconAlt`) for the frontend to pick up the change immediately, with no frontend code change:

- **Upload/replace/remove an icon** → set/change/clear `iconUrl` on that city's record. Clearing it (`null`) makes the fallback reappear automatically.
- **Change a location's name, order, Popular flag, or active state** → already fully data-driven today via `name`, `sortOrder`, `isPopular`, `active` — unchanged by this phase.
- **Add a new city/location and assign it an icon** → add a row with `iconUrl` set; it appears in the popular grid or others list per its `isPopular` flag, with its icon, automatically. Add a new city with `iconUrl` unset/`null` → it appears immediately using the shared fallback, no broken state, until an icon is uploaded later.
- **State-level icons later** → `City.state` already exists as a plain string; if the business later wants a state-level selector, the same `iconUrl`/`iconAlt` pattern (and the same `LocationIcon` component) extends to a `State` record without inventing a new architecture. Not built now — the brief explicitly said not to assume every state needs one.

## 8. Accessibility

- Every location button carries an explicit `aria-label` ("Select Ranchi, Jharkhand") that is also a superset of its visible text, so the accessible name matches what's on screen (WCAG "Label in Name") while still being unambiguous with icon + name + state together.
- Icons are `alt=""` by default (decorative, since the name is always visible beside them) via `LocationIcon`'s `decorative` prop; the component is ready to render a real `alt` if an icon is ever shown with no adjacent name.
- Keyboard: every location button is a real `<button>`, already reachable and activatable by keyboard; `Escape` closes the city-selector modal (pre-existing `HeaderModal` behavior, verified still working). Focus states come from the app's existing global `:focus-visible` rule (`globals.css`) — no per-component focus styling was needed or added.
- **axe-core**: scanning the homepage with the city selector open returned **0 violations** (`wcag2a`, `wcag2aa`, `best-practice`) after one fix described in §9 below.

## 9. A pre-existing issue found and fixed (in scope), and one found but left alone (out of scope)

While axe-scanning the city selector, a real color-contrast failure turned up on the "Popular Cities" / "Other Cities" section labels and the "— Bihar"-style state text: `text-neutral-400` (#a1a1a1) on white measured 2.58:1, against a 4.5:1 requirement for that text size. This class was already present on those exact elements before this phase (inherited, not introduced by the new icon work) but sits inside the two files this phase was already editing (`PopularCityGrid.tsx`, `CityList.tsx`), and the brief's own QA checklist requires axe-core to "remain clean" for this selector — so it was corrected here, changing only the text color utility class (`text-neutral-400` → `text-neutral-500`, the same shade already used for equivalent muted labels elsewhere in this app, e.g. `ServiceDetailSection.tsx`, `OrderSummaryStep.tsx`) with no other visual change.

The identical `text-neutral-400` pattern also exists in `src/components/layout/SearchBox.tsx` (three occurrences, a different, out-of-scope component this phase did not otherwise touch). That file was **not** modified — doing so would mean reopening completed work outside the location selector, which the brief explicitly asked not to do. Flagging it here for a future, deliberate pass rather than leaving it undiscovered.

## 10. QA results

```
npx tsc --noEmit   → 0 errors
npm run lint        → 0 errors, 0 warnings
npm run build        → succeeded, 494 static pages, no warnings
```

Automated (Playwright) checks across 1440px, 1280px, 1024px, 390px, 375px, 360px — 78/78 passed:

- City selector opens at every width.
- Popular cities render with icons; Other cities render with icons; at least 8 location icons load with no broken images at each width (verified with `scrollIntoViewIfNeeded` + `naturalWidth`/`complete` checks, not just an HTTP 200).
- City names remain clearly readable next to their icons.
- Search still works — by city name ("Ranchi") and, additively, by state name ("Jharkhand" → Ranchi + Jamshedpur).
- Selecting a city still navigates to `/[city]` through the existing `LocationProvider` — no second location state exists.
- No horizontal overflow at any width.
- 0 console errors, 0 failed/4xx/5xx network requests.
- `Escape` closes the selector.
- **axe-core: 0 violations** (`wcag2a`, `wcag2aa`, `best-practice`) at every width, after the §9 fix.

A separate, isolated test (data temporarily patched, then reverted — see §4) confirmed the missing-icon fallback renders correctly with no broken image and no console error, and that the layout is unaffected.

A quick sanity pass on `/`, `/ranchi`, `/services`, `/cart`, `/checkout`, `/login` after the change confirmed no unrelated regression (all 200).

## 11. Files changed

- `src/types/index.ts` — added `iconUrl`/`iconAlt` to `City`.
- `src/data/cities.json` — added `iconUrl`/`iconAlt` to all 8 existing cities (no city added/removed/reordered/re-flagged).
- `src/components/location/LocationIcon.tsx` — **new**: the single icon-rendering + fallback component.
- `src/components/location/PopularCityGrid.tsx` — cards now lead with `LocationIcon`; contrast fix (§9).
- `src/components/location/CityList.tsx` — rows now lead with a smaller `LocationIcon`; contrast fix (§9).
- `src/components/location/CitySelectorModal.tsx` — search now also matches `state`; modal scroll area height increased slightly for icon cards.
- `scripts/gen_location_icons.mjs` — **new**: generator for the 9 SVGs below.
- `public/images/locations/ranchi.svg`, `delhi.svg`, `mumbai.svg`, `bengaluru.svg`, `jamshedpur.svg`, `patna.svg`, `pune.svg`, `kolkata.svg`, `fallback.svg` — **new** assets.

Not touched: `src/lib/data/cities.ts` (DAL — already generic), `src/lib/state/LocationProvider.tsx`, `src/components/layout/LocationSelector.tsx`, `Header.tsx`, homepage, footer, cart, checkout, login/account, catalog, pricing, or any business/availability rule.

---

## 12. Landmark Artwork Revision (visual-only follow-up)

**Date:** 2026-09-29
**Scope:** Replace the generic per-city glyphs from §6 with recognizable, original, city-specific landmark line-art. Nothing in §1–§11 above changed — the same `City.iconUrl`/`iconAlt` fields, the same `LocationIcon` fallback logic, the same `PopularCityGrid`/`CityList`/`CitySelectorModal` structure, the same DAL, `LocationProvider`, search, and Admin-Panel-readiness story all carry over untouched. This section documents only the artwork swap.

### Why the generic glyphs were replaced

The client reviewed the first version (a plain mountain/ship/tree/building/waves/anchor/landmark/factory glyph per city, reused from `lucide-react`) and asked for something more specific: each city should show a **recognizable landmark silhouette** — in the spirit of a reference image of Indian-city monument line icons the client shared — not an interchangeable symbol that happens to evoke a general "type" of city. The client was explicit, again, that the reference image itself must not be copied or traced.

### Current city → landmark direction

Eight cities, eight distinct, original silhouettes (no city added, removed, reordered, or re-flagged):

| City | Landmark direction | Why this shape reads distinctly |
|---|---|---|
| Ranchi | Jagannath Temple — a stepped, tiered shikhara (temple tower) | The only stepped-pyramid silhouette in the set |
| Delhi | India Gate — a flat-topped triumphal arch with a mast finial | Flat top + full-width entablature bar, no dome |
| Mumbai | Gateway of India — an arch with a tall domed crown and small corner finials | Domed top + rectangular doorway (straight sides, not another arch) |
| Bengaluru | Vidhana Soudha — a wide, flat-roofed colonnaded building with a central dome | Wide/flat proportions with visible facade columns, distinct from Mumbai's taller narrow arch |
| Jamshedpur | Tata Steel's works — a low industrial shed with three chimneys of different heights, the tallest venting smoke | The only industrial/skyline silhouette |
| Patna | Golghar — a beehive-shaped granary with its signature spiral exterior stripe bands | The only whole-dome/beehive body silhouette (no vertical block beneath it) |
| Pune | Shaniwar Wada — a fortified gateway with two flanking bastion towers and iron-stud doors | Twin flanking towers + stud-dot detail, distinct from Delhi/Mumbai's single-arch compositions |
| Kolkata | Howrah Bridge — a twin-pylon cantilever truss bridge over a two-level deck | The only bridge/truss silhouette |

### Original SVG artwork — no copied reference assets

Every icon is hand-authored path/arc/line geometry in `scripts/gen_location_icons.mjs` — simplified, original interpretations of each landmark's general proportions and silhouette, not a trace or derivative of the client's reference image, a photograph, or any third-party SVG. None reproduce exact architectural detail, inscriptions, or ornamentation of the real structures. All nine assets (8 cities + fallback) went through an iterative visual review pass during this work: the first draft of three icons (Ranchi, Mumbai, Bengaluru) rendered ambiguously at small size — Ranchi read as a lighthouse/rocket, Bengaluru as a flask with legs, Mumbai as three stacked arches rather than one arch with a dome — and were redrawn (stepped tiers with flat treads for Ranchi; columns moved inside the building's own outline for Bengaluru; a single straight-sided doorway plus a taller elliptical dome and simplified corner posts for Mumbai) until each read clearly and stayed clearly distinguishable from the other seven, verified by rendering every icon to PNG and reviewing them individually and as a set, then again inside the real rendered UI (see §12 QA below).

Every icon still uses the same shared badge frame as before (soft neutral circular backdrop, brand-teal accent, consistent stroke width/line-cap/line-join) so the set reads as one coherent "Indian city landmarks" collection rather than eight unrelated styles. The fallback glyph (a plain map pin, hand-authored, no longer generated via a lucide-react import) is unchanged in purpose — a neutral placeholder for any city with no landmark art yet, never mistakable for a real city's landmark.

### `iconUrl`/`iconAlt` architecture — unchanged

`City.iconUrl` still points at `/images/locations/<slug>.svg`; only the file contents changed, not the field, the path convention, or any component's contract with it. `iconAlt` values were updated from `"<City> landmark"` to `"<City> landmark illustration"` (e.g. `"Delhi landmark illustration"`) to match the client's requested phrasing — a content-only change to the same field, not a schema change. `LocationIcon`, `PopularCityGrid`, `CityList`, and the fallback-on-error/fallback-on-null behavior from §3–§4 were not touched by this revision, other than a size bump (below).

### Icon size increase (visual prominence)

Per the client's requested visual size ranges:

- Popular Cities: `PopularCityGrid.tsx` icon size increased from `h-11 w-11` (44px) to `h-16 w-16` (64px) — within the requested ~48–80px range, so the now-recognizable landmark art reads as the card's primary visual rather than a small accent.
- Other Cities: `CityList.tsx` icon size increased from `h-7 w-7` (28px) to `h-9 w-9` (36px) — within the requested ~28–40px range.

### Admin Panel compatibility — unchanged

Nothing here required a frontend code change to the Admin-Panel-readiness story from §7: a future Admin Panel replacing `City.iconUrl` for any city (e.g. uploading a new Delhi asset and pointing `iconUrl` at it) is still picked up automatically by `LocationIcon`, with zero component changes. No city-specific React component (`DelhiIcon.tsx` etc.) was created — every landmark stays an external SVG asset referenced by `iconUrl`, exactly as the architecture requires.

### Fallback verification

Re-verified with the same "patch → rebuild → verify in a real browser → revert" method as §4: Mumbai's `iconUrl` was temporarily set to `null`, the app rebuilt, and the browser confirmed the neutral map-pin fallback rendered in Mumbai's card slot (both size and position preserved) with no broken image and no console error, before the data file was reverted byte-for-byte and rebuilt again.

### Responsive QA

Playwright, all 6 required widths (1440/1280/1024/390/375/360) — 48/48 checks passed:
- City selector modal opens at every width.
- All 8 landmark icons (plus the map-pin fallback, tested separately) render with no broken images.
- No horizontal overflow, on the page or inside the modal, at any width.
- Modal width fits inside the viewport at every width.
- City names remain readable beside their icons; cards stay aligned.
- 0 console errors, 0 failed/4xx/5xx requests at any width.

### Accessibility

`iconAlt` text remains data-driven per city (now `"<City> landmark illustration"`); icons remain decorative (`alt=""`) by default since the city name is always visible beside them, per §3's existing rule — unchanged. axe-core (`wcag2a`, `wcag2aa`, `best-practice`) was run with the city selector open at all 6 widths: **0 violations** at every width.

### Verification

```
npx tsc --noEmit   → 0 errors
npm run lint        → 0 errors, 0 warnings
npm run build        → succeeded, 494 static pages, no warnings
```

Build success alone was not treated as sufficient — every icon was rendered to a standalone PNG and visually reviewed (individually and as a 9-icon contact sheet) before wiring, and the rendered city-selector modal was screenshotted and visually inspected at 1440px and 390px after wiring, confirming the landmark artwork is legible and correctly sized in the actual UI, not just present in the DOM.

### Files changed in this revision

- `scripts/gen_location_icons.mjs` — rewritten: hand-authored original landmark silhouettes replace the previous lucide-react generic glyphs; fallback pin is now hand-authored (no longer a lucide-react import).
- `public/images/locations/*.svg` — all 9 assets regenerated with the new artwork (same filenames/paths, so no `iconUrl` value anywhere needed to change).
- `src/data/cities.json` — `iconAlt` text updated to `"<City> landmark illustration"` for all 8 cities (content only; no field/structure change).
- `src/components/location/PopularCityGrid.tsx` — icon size `h-11 w-11` → `h-16 w-16`.
- `src/components/location/CityList.tsx` — icon size `h-7 w-7` → `h-9 w-9`.

Not touched: `src/types/index.ts`, `src/lib/data/cities.ts`, `LocationIcon.tsx`, `CitySelectorModal.tsx`, `LocationProvider.tsx`, `LocationSelector.tsx`, homepage, header, footer, cart, checkout, login, service cards, pricing, city availability/order/Popular flags, the horizontal rail scroll indicator, or any Admin Panel/backend work.

---

**This is a frontend/architecture-only change.** No Admin Panel, backend, or real image upload was built. No GitHub operation was performed. Waiting for approval before any further step.

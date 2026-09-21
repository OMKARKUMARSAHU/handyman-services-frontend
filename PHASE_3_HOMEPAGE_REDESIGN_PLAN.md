# Homepage Redesign — Gap Analysis & Plan
## Handyman Services Marketplace — Urban Company IA reference

**Status: PLAN ONLY — no code changed yet, per the client's waterfall instruction. Awaiting: (1) confirmation of this plan, (2) the client's actual service/category catalog before the catalog is finalized.**

---

## 1. What was inspected

- Current implementation: `src/app/page.tsx` (city-agnostic homepage), `src/app/[city]/page.tsx` (city homepage), `Header.tsx`, `Hero.tsx`, `CategoryCard/Grid.tsx`, `TrustStatsBand.tsx`, `ServiceCard.tsx`, `ProductCard.tsx`, `LocationSelector.tsx`, `SearchBox.tsx`.
- `PHASE_1_NEW_REQUIREMENTS_ANALYSIS.md`, all `PHASE_2_*.md` docs (especially UI/UX §5 "Homepage" and §7 "Service detail"), `PHASE_3_IMPLEMENTATION_REPORT.md`.
- `urbancompany.com/pune` — structure only (layout/IA), not assets, text, or code. Section order top to bottom: header (logo, live location, search) → hero with category shortcuts + time estimates → trust stats (rating, customer count) → **Spotlight** (promo banners) → **New & Noteworthy** → **Most Booked Services** (rail) → **category-wise service rails** (horizontal scroll, "See all") → footer. Every service card: image, name, star rating, availability/time badge, MRP struck-through + offer price, discount %.

## 2. Where the current build already matches the reference pattern

No rebuild needed here — these stay:

- **Header shell** — logo, search, location selector, account, cart are already present and already location-aware (`LocationSelector` reads the URL city, opens a shared modal). Matches the reference's header role.
- **City-first architecture** — `/[city]/...` URL scoping, `LocationProvider`, `CitySelectorModal` already implement "select a city → catalog scopes to it," which is the core of the reference's location-first UX.
- **`Container`, `Button`, `SectionHeading`** primitives, brand color system (`PHASE_2_UI_UX_DESIGN.md §1` — explicitly says keep Handyman's own visual identity, not Urban Company's).
- **Category → Product → Service → Service Detail → Cart → Checkout route tree** — structurally sound; this is IA, not visual layout, and doesn't change.
- **`ServiceCard`'s pricing block** (MRP struck-through, offer price, discount %) already matches the reference's pricing pattern.

## 3. What needs redesign (visual/structural, same underlying data)

- **Homepage section set and order.** Current homepage: Hero → TrustStatsBand → CategoryGrid → flat Offers grid → HowItWorks → WhyChooseUs → Testimonials → FAQ → CTA. This is a "plans-site" layout carried over from the legacy site, not a marketplace discovery layout. Target order (adapted, not copied): Header → Hero (search + category shortcuts) → Trust stats → **Spotlight** (new) → **New & Noteworthy** (new) → **Most Booked** (new) → **Category-wise service rails** (new — currently categories only link out, they don't show services inline) → How It Works / Why Choose Us / Testimonials / FAQ (kept, but moved below discovery content, matching the reference's pattern of discovery-first, trust-content-second).
- **`CategoryGrid`/`CategoryCard`** — visually fine (image-led cards), but on the reference the hero itself also carries quick category shortcuts (icon + time estimate) above the fold. Proposed: keep `CategoryGrid` as the main "Browse by Category" section, and skip cloning the icon-shortcut hero row unless the client wants it — flagging as a decision point (§6).
- **`ServiceCard`** needs to grow from a plain grid card into a **rail card**: currently used inside a static grid (`ServiceList`); the reference's rails are horizontally scrollable with "See all." Needs a new `ServiceRail` wrapper component (horizontal scroll + snap, "See all" link to a filtered view) reusing the existing `ServiceCard`.
- **Offers section** — currently a plain 3-column grid of text tiles. Reference's "Spotlight" is a promotional-banner pattern (image-led, larger tiles). Needs a new `SpotlightBanner`/`OfferTile`-at-scale component; underlying data still comes from the existing `Offer` entity — no new entity needed for this alone.

## 4. What needs to be newly built (no equivalent exists today)

- **`ServiceRail`** — horizontal-scroll container + "See all" link, used by New & Noteworthy, Most Booked, and each category-wise rail.
- **Category-wise service rails on the homepage** — today, services only ever appear on the Product page or the city homepage's single flat "Featured" list. The reference shows several *service-level* rails directly on the homepage, grouped by category. This needs a new DAL query (e.g. `getServicesByCategory(categoryId, cityId)`, grouped/limited) and a homepage section that iterates confirmed categories.
- **Spotlight promo section** — new component, reuses `Offer` entity (no schema change required for the minimal version).
- **Rating display on `ServiceCard`** — the current `Service` type has no rating field at all. `PHASE_2_DATA_ARCHITECTURE.md §Service` already anticipated this and explicitly marked `ratingAverage`/`ratingCount` as **`[TBD]` — "populated only if/when reviews are in scope."** This is a real decision point, not a trivial add — see §6.
- **"Instant"/time-estimate badge** — the reference's badge reflects Urban Company's on-demand/gig-dispatch model. Handyman's confirmed model is Installation/Service/Repair/AMC with booking-slot rules still **TBD**. Copying this badge as-is would visually promise instant dispatch Handyman doesn't have — flagged in §6, not built by default.

## 5. Data model extensions required (additive only, non-breaking)

All additive to the existing `Service`/`Category` types — no breaking changes to Phase 2's approved schema:

| Field | Entity | Purpose | Status |
|---|---|---|---|
| `featured` (exists) | Service | already drives "Featured" rail | reuse for New & Noteworthy unless client wants a distinct flag |
| `isMostBooked` or similar Admin-curated flag | Service | drives Most Booked rail without real order data | **new — proposed to resolve Open Question #18** (see §6) |
| `ratingAverage`, `ratingCount` | Service | star rating on cards | **new — was already anticipated as TBD in Phase 2; needs explicit client go-ahead, see §6** |
| `badgeText` (optional, e.g. "Same day") | Service | reference's availability badge, made generic/honest rather than "Instant" | **new — optional, only if client confirms §6** |

No changes needed to `City`, `Product`, `ServiceType`, `Offer`, `Cart`, `Order` entities for this redesign.

## 6. Decision points — not resolved here, flagged per the waterfall/TBD rule

These directly touch open items already on record (`PHASE_2_OPEN_QUESTIONS.md`, and the carried-forward TBD list in `PHASE_3_IMPLEMENTATION_REPORT.md`). Nothing below has been decided or guessed:

1. **Most Booked section (Open Question #18).** Real booking-volume data doesn't exist. Proposed resolution — an **Admin-curated boolean flag** (`isMostBooked`), not a computed ranking — matches the client's own instruction that New & Noteworthy "must be data-driven so services can later be added/removed from admin/backend." If confirmed, the same pattern can drive Most Booked too. Will not implement without confirmation, since this changes how `getMostBookedServices` currently behaves (Phase 3 intentionally returns `[]`).
2. **Star ratings.** Phase 1/2 explicitly left reviews/ratings as TBD, with no review-writing feature in scope. Proposed: add `ratingAverage`/`ratingCount` as **Admin-set display numbers only** (no user reviews, no review text) purely to match the visual pattern — not a review system. Needs explicit confirmation before adding, since it's new scope beyond what Phase 2 approved.
3. **"Instant"/time-estimate badges.** These reflect Urban Company's own on-demand dispatch model. Handyman's booking-slot rules are still TBD. Recommend a neutral, honest label (e.g., nothing, or "Available in \<city\>") instead of implying instant dispatch — unless the client confirms real same-day/instant capability exists.
4. **Hero category shortcuts with time estimates** — same time-estimate concern as #3; proposed to omit the estimate, keep icon shortcuts only, if this row is wanted at all.

## 7. Routes

No route changes required. `/`, `/[city]`, `/[city]/[category]`, `/[city]/[category]/[product]`, `/[city]/service/[serviceSlug]` all stay as-is. The new rails are homepage/city-homepage *sections*, and category-wise rails reuse existing category/product/service routes for their card links and "See all" targets.

## 8. Explicitly waiting on

- **Client's actual service/category catalog** — the current `products.json`/`services.json`/`categories.json` are Phase 3 placeholders (documented as such in the Phase 3 report). Nothing in this plan finalizes the catalog; the catalog is swapped in once provided, independent of the component/section work above.
- **Confirmation on the four decision points in §6** before touching `Service`'s schema or building the Most Booked / rating / badge features.
- **Sign-off on the section order in §3** before restructuring the homepage.

No code has been written for this redesign yet. Once the plan is confirmed and the catalog is provided, implementation proceeds component-by-component (rails → spotlight → homepage restructure → city-homepage restructure), followed by the same build/lint/typecheck verification used in Phase 3.

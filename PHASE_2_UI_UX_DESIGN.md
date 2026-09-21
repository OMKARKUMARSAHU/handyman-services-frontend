# Phase 2 — UI/UX Design
## Handyman Services Marketplace

**Status:** Phase 2 draft, pending client approval. No UI implemented from this document yet.
**Builds on:** `PHASE_1_NEW_REQUIREMENTS_ANALYSIS.md`, `PHASE_2_DATA_ARCHITECTURE.md`, `PHASE_2_PAGE_STRUCTURE.md`.
**Design reference note:** Urban Company was reviewed only for its general structural pattern (location selector → visual category grid → service detail → booking), confirmed via a structural review, not its visual design, copy, imagery, or code. Everything described below is original to Handyman Services: existing brand colors, typography, and component language (see §1) are retained and extended, not replaced.

---

## 1. Visual identity (retained, not reinvented)

The existing design system is kept as the foundation:

- **Brand color:** deep teal scale (`brand-50`…`brand-900`, base `#2a8d7e`), already established as "trustworthy, professional" in the current design tokens (`src/app/globals.css`).
- **Accent, neutral scales**, and the existing system-font stack — unchanged.
- **Component language:** rounded-lg cards, soft shadows, the existing `Button`/`Badge`/`Container`/`SectionHeading` primitives — extended to new marketplace surfaces (service cards, cart, checkout) rather than replaced with a different visual style.

This satisfies the client's explicit instruction that visual design/branding remain original to Handyman Services throughout the re-scope.

## 2. Information architecture (top level)

```
Location → Category → Product/Appliance → Service Type → Service → Service Detail
                                                              ↓
                                                     Cart / Buy Now → Checkout → Order
```

This is the approved Phase 1 hierarchy (client's approval message, item 2), carried through unchanged into the UI.

## 3. Header

- **Location selector** — leftmost after logo (or logo-adjacent), showing the currently selected city; opens the city-selection experience (§4). Builds on the existing `LocationSelector`/`HeaderActionModal` pattern, replacing free-text entry with real city data.
- **Search** — prominent, icon + expandable field as today, now searching categories/products/services (Data Access Layer-backed, per `PHASE_2_SYSTEM_ARCHITECTURE.md` §8).
- **Account** — login entry point (method TBD); builds on the existing `AccountButton` shell.
- **Cart** — icon with item-count badge; opens a cart drawer (§7) rather than the current static "empty" modal.
- Primary navigation simplifies to **category-led browsing** (categories become the primary discovery path, not a fixed page-name list) — exact label set is a Phase 3 content decision, not fixed here.

## 4. City selection experience

Conceptual flow, per Phase 1 §3 (client's own diagram):

```
Select Your City
  → Search City (text input, filters the list live)
  → Popular Cities (City.isPopular = true, shown first, as a grid/chip set)
  → Other Cities (remaining active cities, alphabetical)
  → Selected City → catalog scopes to it (PHASE_2_PAGE_STRUCTURE.md §1–2)
```

Presented as a modal/panel (reusing the existing `HeaderModal` pattern) rather than a full-page takeover, consistent with the current site's lightweight-modal approach and with `PHASE_2_SYSTEM_ARCHITECTURE.md`'s "scope, don't gate" default (§4, flagged there as pending client confirmation).

## 5. Homepage (redesigned around discovery)

Replacing the current plan-comparison-centric layout, per Phase 1 §15:

```
HEADER (§3)
HERO — home-services messaging, prominent search, location awareness (not a copy of
       the reference site's hero — original headline/imagery per Handyman Services brand)
POPULAR CATEGORIES — visual grid (extends the existing CategoryGrid/CategoryCard pattern)
FEATURED / NEW SERVICES — data-driven rail, not hardcoded
MOST-BOOKED SERVICES — data-driven rail (requires order-count data; until real orders
       exist, this section is either omitted or Admin-curated — [TO BE CONFIRMED])
OFFERS / PROMOTIONS — banner/tile(s) sourced from the Offer entity
TRUST / SERVICE INFORMATION — reuses the existing WhyChooseUs/TrustStatsBand pattern
FOOTER
```

The exact section list/order is explicitly noted by the client as subject to refinement during UI/UX design (Phase 1 request §15) — this is that refinement pass; final content per section is a Phase 3 detail.

## 6. Category → Product → Service browsing

- **Category page** (`/[city]/[category]`): grid of `Product` cards (image-led, extending `CategoryCard`'s visual pattern), scoped to the selected city.
- **Product page** (`/[city]/[category]/[product]`): list/grid of `Service` cards grouped or filterable by `ServiceType` (Installation/Service/Repair/AMC tabs or filter chips), each card showing image, name, MRP/offer price, and a quick Add-to-Cart affordance — extending the existing `ServiceDetailSection` appliance-list pattern into a richer, priced card.
- Empty state (no services available for this product in this city) is explicit and honest ("Not yet available in \<city\>"), never a silently empty page — consistent with the existing project's practice of never showing broken/placeholder-looking UI to visitors.

## 7. Service detail page

Per Phase 1 §7/§15 (client's explicit content list):

```
SERVICE TITLE
Image gallery — main image + up to 4+ additional, swipeable/thumbnail-navigable
Rating/review summary — [TO BE CONFIRMED, omitted entirely until reviews are in scope]
MRP (struck through) · Offer Price · Discount badge (computed, PHASE_2_DATA_ARCHITECTURE.md §3)
Offer/promotional tile (if an applicable Offer exists) — [TBD] shown as informational only;
       whether this Offer's discount stacks with, replaces, or otherwise interacts with the
       MRP/Offer-Price discount above is unconfirmed (PHASE_2_DATA_ARCHITECTURE.md §3, Open
       Question #25) — this page does not display or imply a combined/stacked total
Description
What's Included (bullet list)
Availability (this city; TBD: slot-level detail, Phase 1 §43)
Add to Cart · Buy Now · Share  (primary actions, in that order — Add to Cart first as the
       lower-commitment action, Buy Now as the express path, per standard marketplace
       convention; not a claim about the reference site's exact layout)
```

Builds directly on the existing `ServiceDetailSection` component's structure (image + text + CTA panel), extended with the gallery, pricing, and cart actions it currently lacks.

## 8. Cart

- **Cart drawer** (slide-over from the header cart icon) for quick add/review, plus a full `/cart` page for the complete view — both reading from the same `CartProvider` state (`PHASE_2_SYSTEM_ARCHITECTURE.md` §5).
- Each line: service image/name, service type, quantity stepper, unit price, line subtotal, remove control.
- Cart-level subtotal, with a clear "Proceed to Checkout" action.
- Multiple services from different categories/products in one cart is a first-class case, not an edge case (Phase 1 §17 explicit instruction) — the UI does not assume or optimize for a single-item cart.
- **`[TBD]`** Multiple services from *different cities* in one cart is **not yet resolved** — this is a distinct question from the categories/products case above. Whether the cart UI should warn, block, split, or otherwise handle adding a second city's service depends on the unresolved business rule in `PHASE_2_DATA_ARCHITECTURE.md` §3 (Cart/CartItem) and Open Question #24 (`PHASE_2_OPEN_QUESTIONS.md`). No such behavior is designed here until that rule is confirmed.

## 9. Checkout

Three in-page steps (per `PHASE_2_PAGE_STRUCTURE.md` §3): Address (select saved or enter new) → Date/Time (exact slot UI is TBD, Phase 1 §43 — placeholder as a simple date + general time-of-day preference until slot rules are confirmed) → Order Summary (items, address, schedule, total) → confirm. Payment step is a placeholder screen only until a gateway is confirmed (Phase 1 §18), clearly not presented as a working payment form.

## 10. Order confirmation

Simple confirmation screen: order number, summary, "what happens next" messaging (honest about current fulfillment state — e.g., a team member will confirm by phone/WhatsApp — rather than implying automated provider dispatch that doesn't exist yet, consistent with the existing site's practice of not showing capabilities that aren't real).

## 11. Login

UI shell only in Phase 3 (method TBD, Phase 1 §19) — a single, honest "Login" entry point that can accommodate whichever method is confirmed (OTP screen, password form, or social buttons) without a structural redesign, mirroring how the existing `AccountButton`'s placeholder was deliberately built as an honest "coming soon" state rather than a fake form.

## 12. Responsive behavior

Every new surface follows the existing project's tested discipline: mobile-first layout, the established `lg` (1024px) breakpoint for the desktop/mobile navigation split (the current project has an explicit, tested fix for a prior mobile-header overflow bug at this exact breakpoint — new header elements, especially the city selector and cart badge, must be budgeted into the same width-tested pattern, not added carelessly). Cart drawer becomes a full-screen sheet on mobile; category/product/service grids collapse to 1–2 columns.

## 13. Accessibility

Every modal/drawer (city selector, cart, search) follows the existing `HeaderModal` pattern's accessibility baseline (`role="dialog"`, `aria-modal`, Escape-to-close, focus handling) — extended, not reinvented, for the new cart drawer and checkout steps. Form steps in checkout get the same labeled-input/validation-message discipline as the existing `ContactForm`.

## 14. Explicitly deferred design work

Admin Panel UI and Service Provider dashboard UI are **not designed in this document** — per the client's Phase 1 scoping, these are architecturally accommodated (`PHASE_2_DATA_ARCHITECTURE.md`) but not visually designed until separately scoped (Phase 1 §21–22, §43).

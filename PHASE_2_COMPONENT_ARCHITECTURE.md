# Phase 2 — Component Architecture
## Handyman Services Marketplace

**Status:** Phase 2 draft, pending client approval. No components implemented from this document yet.
**Builds on:** `PHASE_1_NEW_REQUIREMENTS_ANALYSIS.md` §32–36, `PHASE_2_DATA_ARCHITECTURE.md`, `PHASE_2_SYSTEM_ARCHITECTURE.md`, `PHASE_2_UI_UX_DESIGN.md`. This document turns Phase 1's reuse/refactor/remove/new *analysis* into a concrete component-level plan.

---

## 1. Folder structure (extension of the existing layout)

```
src/components/
  ui/            Unchanged: Button, Container, Badge, PageHeader, SectionHeading
  layout/        Header, Footer, MobileMenu, StickyMobileCTA, WhatsAppButton (unchanged),
                 HeaderActionModal (unchanged, reused as the base modal/drawer pattern),
                 LocationSelector (refactored), AccountButton (refactored),
                 CartButton (refactored) — see §3
  location/      NEW — city search/list/selection UI
  catalog/       NEW — category/product/service browsing (grid, cards, filters)
  service/       NEW — service detail (gallery, pricing, CTAs); existing
                 ServiceDetailSection refactored into this family (§3)
  cart/          NEW — cart drawer, cart page, cart line item
  checkout/      NEW — address, schedule, summary steps
  account/       NEW — placeholder shell only (§6)
  home/          Existing components retained where still relevant (Hero, TrustStatsBand,
                 HowItWorks, WhyChooseUs, TestimonialCarousel, FAQAccordion, CTASection);
                 CategoryCard/CategoryGrid refactored (§3); homepage composition changes
                 per PHASE_2_UI_UX_DESIGN.md §5
  plans/         Unchanged code, but excluded from primary navigation/homepage
                 composition (legacy status, per client's Phase 1 decision)
  forms/         ContactForm unchanged; its field/validation pattern is the template
                 for the new checkout Address step, not shared code (different data shape)
```

## 2. State ownership

Per `PHASE_2_SYSTEM_ARCHITECTURE.md` §5, two new Context providers live at the app root (`src/app/layout.tsx`, alongside the existing `Header`/`Footer`/`StickyMobileCTA`):

- `CartProvider` — cart state, exposed via a `useCart()` hook to any component in `cart/`, `service/` (Add to Cart), and the header's `CartButton`.
- `LocationProvider` — selected-city convenience state, exposed via `useLocation()` to `LocationSelector`, catalog pages (for redirect/default behavior), and anywhere a "you're browsing in \<city\>" indicator is shown.

Every other component remains **presentational**, receiving data via props from a page that has already called the Data Access Layer — continuing the existing project's server-component-first pattern (pages fetch, components render) rather than pushing data-fetching into leaf components.

## 3. Component-by-component plan

### Reused as-is (from Phase 1 §33)

`Button`, `Container`, `Badge`, `SectionHeading`, `PageHeader`, `HeaderActionModal`, `Header`/`Footer` shell, `MobileMenu`, `StickyMobileCTA`, `WhatsAppButton`.

### Refactored

| Component | Change |
|---|---|
| `LocationSelector` | Free-text + `localStorage` → real `City` data, search + popular/other split (`PHASE_2_UI_UX_DESIGN.md` §4), writes to `LocationProvider` and the URL city segment |
| `AccountButton` | "Coming soon" placeholder → real login entry point once auth method is confirmed; until then, stays an honest placeholder but restructured to open `/login` rather than an inline modal, since login is now a full flow, not a one-off message |
| `CartButton` | Static "empty" modal → live item-count badge + opens the new cart drawer, reading `useCart()` |
| `CategoryCard` / `CategoryGrid` | Same visual pattern (image-led card), now routes into `/[city]/[category]` and renders `Product` entities one level down instead of linking directly to a flat appliance list |
| `ServiceDetailSection` | Becomes the base for the new `service/ServiceDetail` component family — gallery, pricing block, and cart actions added; its existing appliance-list-with-icon-fallback pattern is reused for "what's included" and related items |
| Homepage (`src/app/page.tsx`) | Recomposed per `PHASE_2_UI_UX_DESIGN.md` §5; existing section components (`TrustStatsBand`, `HowItWorks`, `WhyChooseUs`, `TestimonialCarousel`, `FAQAccordion`, `CTASection`) are individually reused, just reordered/supplemented with new catalog-discovery sections |

### New components required

| Family | Components |
|---|---|
| `location/` | `CitySearchInput`, `PopularCityGrid`, `CityList`, `CitySelectorModal` (composes the above inside `HeaderModal`) |
| `catalog/` | `ProductCard`, `ProductGrid`, `ServiceCard`, `ServiceList`, `ServiceTypeFilter` (Installation/Service/Repair/AMC chips/tabs) |
| `service/` | `ServiceGallery`, `ServicePriceBlock` (MRP/offer/discount, using the shared `lib/pricing.ts` helper from `PHASE_2_SYSTEM_ARCHITECTURE.md` §7), `ServiceActions` (Add to Cart/Buy Now/Share), `OfferTile`, `ServiceReviewSummary` (built but hidden/unused unless reviews are confirmed — `[TBD]`) |
| `cart/` | `CartDrawer`, `CartPage`, `CartLineItem`, `CartSummary` |
| `checkout/` | `AddressStep`, `ScheduleStep` (date + general time-of-day only, pending slot-rule confirmation), `OrderSummaryStep`, `CheckoutStepper` |
| `account/` | `AccountShell` — placeholder navigation for Profile/Addresses/Orders sections, each rendering an honest "coming soon" or minimal state until scope is confirmed (Phase 1 §41/§43), mirroring how `AccountButton`'s current placeholder is handled today (never a fake/broken screen) |

## 4. Props/interfaces convention

Every new component receives its data as typed props sourced from `PHASE_2_DATA_ARCHITECTURE.md` entities (e.g. `ServiceCard({ service: Service })`), never fetching data itself — continuing the existing convention where, e.g., `CategoryCard` takes a `Category` prop rather than calling `getCategories()` internally. Full prop-level interfaces are a Phase 3 implementation detail, not enumerated field-by-field here.

## 5. Removed / excluded from primary composition

Per Phase 1 §35 and the client's Phase 1 approval (§4): `PlanCard`/`PlanComparisonTable` are **not removed from the codebase**, but are excluded from the new homepage and primary navigation composition. They remain available to reinstate without rework if the client later reconfirms the Plans model.

## 6. Account area — deliberately minimal

Per Phase 1 §41/§43 (account-area exact scope still TBD), `account/AccountShell` is scoped in this document as a **navigational placeholder only** (tabs/links for Profile/Addresses/Orders that each show a clear, honest "not yet available" or minimal read-only state) — not a fully working profile/address-book/order-history implementation. This avoids building specific account features the client hasn't confirmed, while still giving Phase 3 a concrete, small target rather than an open-ended one.

## 7. Explicitly not covered

Admin Panel and Service Provider dashboard components are not designed here, consistent with every other Phase 2 document — the data they'd bind to exists (`PHASE_2_DATA_ARCHITECTURE.md`), the UI does not, pending separate scoping (Phase 1 §21–22).

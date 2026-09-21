# Phase 2 — Page Structure
## Handyman Services Marketplace

**Status:** Phase 2 draft, pending client approval. No routes implemented from this document yet.
**Builds on:** `PHASE_1_NEW_REQUIREMENTS_ANALYSIS.md`, `PHASE_2_DATA_ARCHITECTURE.md`, `PHASE_2_SYSTEM_ARCHITECTURE.md` (§4/§6 — URL-based city scoping, ISR rendering).

---

## 1. URL scheme

**Decision (flagged in Phase 1 §27/§37 as TBD, resolved here for Phase 2):**

```
/                                     Homepage (city-agnostic shell; see §2)
/[city]                               City homepage — categories scoped to this city
/[city]/[category]                    Category page — products in this category, this city
/[city]/[category]/[product]          Product page — services for this product, this city
/[city]/service/[serviceSlug]         Service detail page
/cart                                 Cart (not city-scoped in the URL; cart items each resolve to a
                                       Service, which is city-scoped internally — see §1a: how a
                                       cart spanning more than one city is handled at checkout is
                                       [TBD], not decided)
/checkout                             Checkout (address → schedule → summary as steps, not separate routes — see §3)
/order-confirmation/[orderId]         Order confirmation
/login                                Login (method TBD, Phase 1 §19)
/account, /account/orders, /account/addresses   Account area (scope per Phase 1 §41/§43)
/about, /faq, /contact, /privacy, /terms        Retained marketing/support pages, unchanged
/plans                                LEGACY — retained as a route only if the client later
                                       reconfirms Plans (Phase 1 §4); not linked from primary
                                       navigation or the new homepage in this design
```

City segment uses each city's `slug` (from `PHASE_2_DATA_ARCHITECTURE.md`'s `City` entity); category/product use their own `slug`; services use a `serviceSlug` that is unique site-wide (simpler than a compound category/product/service path, and avoids broken links if a service moves between products later).

### 1a. `[TBD]` Multi-city cart behavior — unresolved business rule

Because catalog URLs are city-scoped but `/cart` is not, a customer can browse City A, add a service, navigate to City B, and add another service — cart items can structurally carry their own city context. **What is not decided:** whether checkout should determine a single service city per order (restricting a cart to one city, and requiring a new/second cart for a different city), split checkout into separate orders per city automatically, or apply some other rule. No option is assumed. See `PHASE_2_DATA_ARCHITECTURE.md` §3 (Cart/CartItem) and Open Question #24 (`PHASE_2_OPEN_QUESTIONS.md`) — this must be resolved before Phase 3 implements cart/checkout.

**Rationale for `/[city]/...` over city-as-query-param or city-only-in-state:** established in `PHASE_2_SYSTEM_ARCHITECTURE.md` §4 — crawlability, shareability, and static/ISR-renderability all require the city to be part of the URL, not only client state.

## 2. Homepage behavior

`/` (no city in the URL) is the entry point for a first-time visitor. Per `PHASE_2_SYSTEM_ARCHITECTURE.md` §4, this document assumes city *scopes* rather than *gates* the site (flagged there as pending explicit client confirmation): `/` shows the location-selection prompt prominently (hero-level, not a blocking modal) alongside generally browsable content (all categories, unscoped by city), and once a city is selected, the user is taken to `/[city]` for a scoped experience. If the client instead wants a hard gate (no content until a city is chosen), that changes `/` to a dedicated selection screen — a small change to this section, not a different architecture, and should be confirmed before Phase 3.

## 3. Checkout as steps, not separate routes

`/checkout` is a single route with internal step state (address → date/time → summary), rather than `/checkout/address`, `/checkout/schedule`, etc. Rationale: the three steps share one in-progress `Order` draft that shouldn't be independently bookmarkable/reloadable mid-flow (a reload on step 2 shouldn't lose step 1's address). Payment, when built, is the exception — kept as its own concern noted in `Order.paymentStatus` (`PHASE_2_DATA_ARCHITECTURE.md`), not designed further here since the gateway is TBD (Phase 1 §43).

## 4. Route-by-route rendering strategy

(Full rationale in `PHASE_2_SYSTEM_ARCHITECTURE.md` §6; this is the per-route assignment.)

| Route | Strategy |
|---|---|
| `/`, `/about`, `/faq`, `/privacy`, `/terms` | Static |
| `/[city]` | ISR |
| `/[city]/[category]` | ISR |
| `/[city]/[category]/[product]` | ISR |
| `/[city]/service/[serviceSlug]` | ISR |
| `/cart`, `/checkout`, `/order-confirmation/[orderId]` | Dynamic (client/session-specific) |
| `/login`, `/account*` | Dynamic, auth-gated (not built in Phase 3 per client scope; route reserved) |
| `/contact` | Static shell + existing client-side form (unchanged from today) |

## 5. generateStaticParams / ISR seeding

For the city/category/product/service routes, `generateStaticParams` seeds the initially-known combinations from mock data (mirroring today's `generateStaticParams` on `/services/[category]`), with ISR (`revalidate`) periodically re-rendering pages from that same mock-data source rather than requiring a full rebuild for every page. This preserves the existing project's SSG-first instinct where it still fits, while fixing the scaling problem Phase 1 §45 flagged.

**`[Clarified]`** In Phase 3 (mock JSON + Data Access Layer, no Admin UI), a new or changed catalog combination still requires a normal development/build/deployment cycle like any other content change — ISR is not a substitute for that and does not let an Admin change the catalog without a deploy, because no Admin-facing write path exists yet. A future real backend/Admin implementation could use ISR/revalidation to reflect backend-driven catalog changes without a manual frontend rebuild, but that capability depends on that future backend and is explicitly out of scope for Phase 3.

## 6. Metadata / SEO

Every city/category/product/service route implements `generateMetadata`, following the exact existing pattern (`src/app/services/[category]/page.tsx` already does this for categories). `sitemap.ts` and `robots.ts` are extended to enumerate the larger route tree from mock data the same way they enumerate today's 5 categories. No new SEO mechanism is introduced — this is a direct extension of what's already built and working.

## 7. Navigation changes

- Primary header navigation moves from the current fixed Home/Services/Plans/Contact set to a structure centered on **Location + Search + Categories**, detailed in `PHASE_2_UI_UX_DESIGN.md`. Exact final nav labels are a UI/UX-design-level decision, not fixed here.
- `Plans` is removed from primary navigation per the client's Phase 1 decision (§4) — retained only as a legacy route if it exists at all (§1).
- Cart and Account gain first-class header entry points, building on the existing `CartButton`/`AccountButton` icons (currently non-functional placeholders) — now wired to real state per `PHASE_2_SYSTEM_ARCHITECTURE.md` §5.

## 8. Not part of this document

Admin and Service Provider route structure is intentionally **not specified here** — per Phase 1 §37/§43, whether those live inside this same frontend app or as separate applications is still TBD, and designing routes for them now would be inventing scope the client hasn't confirmed. The data architecture (`Customer`, `ServiceProvider`, Admin-manageable entities) is ready either way.

# Phase 1 — New Requirements Analysis
## Handyman Services: Marketplace Platform Re-Scope

**Status:** Phase 1 (Requirement Re-Analysis) — DRAFT FOR CLIENT REVIEW
**Supersedes:** The original Phase 1–4 scope (simple 4-page site: Home / Services / Plans / Contact, annual Silver/Gold/Platinum subscription plans)
**Prepared following:** Waterfall SDLC, restarting at Phase 1 per client instruction
**No code has been changed to produce this document.** This is analysis only.

---

## 1. Executive Summary

The client has reviewed the current live Handyman Services frontend (deployed on Vercel, source at `github.com/OMKARKUMARSAHU/handyman-services-frontend`) and rejected its product direction. The current site is a simple four-page marketing site built around three fixed annual subscription plans (Silver/Gold/Platinum). The client now wants Handyman Services to become a **location-first, category-driven home-services marketplace**, structurally modeled on Urban Company's general information architecture and UX flow (location → category → product/appliance → service → service detail → cart/buy-now → checkout → order → provider fulfillment), while remaining entirely original in branding, content, imagery, and code.

This is a **ground-up re-scope, not a redesign of the current homepage**. The subscription-plan model is being replaced (or at minimum de-emphasized in favor of) a per-service, priced, bookable catalog. The data model, navigation, page structure, and much of the component set need to change. Some existing infrastructure — the Next.js/TypeScript/Tailwind foundation, the Data Access Layer pattern, and several already-built header UI affordances (search, location, account, cart icons) — is directly reusable or a strong starting point, detailed in §31–35.

This document inventories the existing system, translates the client's new requirements into functional and non-functional requirements, proposes a data model and information architecture, and separates what is confirmed from what is assumed. **Nothing proceeds to Phase 2 (System/Data/UI Design) until the client has reviewed and approved this document, and resolved the items marked `[TO BE CONFIRMED]`.**

---

## 2. Existing System Analysis

Verified directly against the current codebase (not assumed):

- **Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict), Tailwind CSS v4, lucide-react, clsx. No database, no auth library, no payment SDK, no cart/order code of any kind.
- **Repository/deployment:** GitHub repo `OMKARKUMARSAHU/handyman-services-frontend`, branch `main`, connected to a live Vercel deployment.
- **Routes today:** `/`, `/services`, `/services/[category]` (5 statically generated categories), `/plans`, `/about`, `/faq`, `/contact`, `/privacy`, `/terms`, plus generated `/robots.txt` and `/sitemap.xml`.
- **Business model today:** Three fixed annual plans (Silver/Gold/Platinum) with flat pricing, a fixed appliance coverage count, and a "Request a Service" lead form (`ContactForm.tsx`) that collects name/contact/address/city/state as free text plus a plan/appliance selection. Submission goes to a **mock `submitLead()` function** (`src/lib/data/leads.ts`) that simulates latency and does not persist or transmit data anywhere — there is no real backend today.
- **Data-driven architecture already in place:** All business content is read through accessor functions in `src/lib/data/*` (`getPlans()`, `getCategories()`, `getAppliances()`, `getFAQs()`, `getTestimonials()`, `getContactInfo()`, `getHomepageSection()`, `getPrimaryNav()`/`getFooterNav()`), backed today by local JSON in `src/data/*.json`. Components never import JSON directly. This seam is exactly the pattern the new requirements ask for (§17–18) and is a direct asset, not something to rebuild from scratch.
- **Existing entities (in `src/types/index.ts`):** `Plan`, `Category`, `Appliance`, `Service` (defined but not currently used by any page), `Testimonial`, `FAQ`, `ServiceLocation` (defined but **entirely unused** — no data file, no accessor, no consumer), `ContactInfo`, `HomepageSection`, `NavItem`, `LeadPayload`/`LeadSubmissionResult`.
- **Existing category/appliance hierarchy:** 5 categories (Cooling, Kitchen Appliances, Water & Heating, Laundry, Entertainment) each containing a list of `Appliance` records (12 appliances total) — this is a two-level hierarchy (Category → Appliance) with **no service-type layer underneath** (no Installation/Repair/Service/AMC breakdown per appliance today).
- **Header UI already built (frontend-only, no backend):** a location selector (free-text, saves to `localStorage`, no real city list or availability logic), a search box (client-side substring filter over categories/appliances), an account icon (opens a "sign-in coming soon" placeholder, no real auth), and a cart icon (opens a static "cart is empty" placeholder, no real cart state, no `CartItem`/`Order` types exist anywhere in the codebase). These are UI shells built ahead of this marketplace requirement and are a meaningful head start on §3, §9, and §12 below, but none of them are functionally wired to real data or state yet.
- **No admin panel, no authentication, no database, no payment integration, no booking/scheduling system, no service-provider concept** exist anywhere in the current code.

---

## 3. Client's New Requirement

Bring an Urban Company-style, location-first home-services marketplace experience to India under the **Handyman Services** brand — original branding, content, and implementation throughout, using Urban Company only as a reference for product hierarchy, interaction patterns, and information architecture (confirmed via a structural review: geographic/location selection first, then a visual category grid, then service detail and booking — never its copy, imagery, or code).

Core shift: from "pick one of 3 fixed annual plans" to "search or browse a data-driven, city-scoped catalog of individually priced, bookable services, organized as City → Category → Product/Appliance → Service Type → Service," with three user roles (Customer, Admin, Service Provider) and the standard commerce primitives (cart, buy-now, checkout, order, pricing/discounts, offers).

---

## 4. Functional Requirements

Numbered for traceability; MUST/SHOULD/FUTURE/UNKNOWN classification is in §39–42, this section states the requirement itself without re-litigating priority.

- FR-1: Users can select, search, and change their city/location; catalog availability is scoped to the selected city.
- FR-2: Users can browse services through a City → Category → Product/Appliance → Service Type → Service hierarchy.
- FR-3: Categories, products/appliances, services, service types, cities, pricing, offers, and images are all data-driven and addable without frontend code changes.
- FR-4: Each service has a detail page with a multi-image gallery (3–5+ images), description, MRP, offer price, computed/stated discount, "what's included," availability, Add to Cart, Buy Now, and Share.
- FR-5: Users can add one or more services to a cart, view/adjust quantities, and see a computed subtotal.
- FR-6: Users can bypass the cart via "Buy Now" for a single-service express flow.
- FR-7: Checkout (from either cart or Buy Now) collects address and date/time, shows an order summary, and (pending payment-gateway confirmation, §10) produces an order confirmation.
- FR-8: A site-wide search returns matching categories/products/services from the data layer (client-side against mock data now; API-ready later).
- FR-9: Customers can log in and access an account area (scope of that area is §12/§39–42).
- FR-10: An Admin role can manage cities, categories, products/appliances, services, service types, pricing, offers, and city-availability (architecture-ready now; UI implementation is a separately scoped, later effort — see §13, §26).
- FR-11: A Service Provider role can view assigned jobs and job/customer/schedule details (architecture-ready now; not necessarily built now — see §14).

---

## 5. Non-Functional Requirements

- NFR-1 (Data-driven): No business data (cities, categories, products, services, prices, offers) may be hardcoded into UI components. All of it flows through a Data Access Layer, exactly as today's `src/lib/data/*` pattern already does.
- NFR-2 (Backend-agnostic): The frontend must not assume its data source is local JSON forever; swapping to a REST/WordPress/WooCommerce/custom API must not require rewriting UI components (§18, §25, §38).
- NFR-3 (Responsive): Every new page/flow must work at mobile, tablet, and desktop widths with no horizontal overflow (continuing the standard already met by the existing site).
- NFR-4 (Accessibility): Continue the existing site's practice of accessible semantics, keyboard operability, and passing automated accessibility checks (axe) with zero violations.
- NFR-5 (SEO): Category, product, and service pages must be crawlable/indexable and support per-page metadata, following the existing `generateMetadata`/`sitemap.ts`/`robots.ts` pattern.
- NFR-6 (Performance): Maintain the existing site's Lighthouse performance discipline (the current site scores in the high 90s/100) as the catalog grows — image optimization and pagination/virtualization become more important as city/category/service counts grow.
- NFR-7 (Security): No credentials, tokens, or payment data may be handled or stored by the frontend in this phase; any future auth/payment integration must follow standard secure practices (HTTPS, no client-side secret storage) — see §29.
- NFR-8 (Originality): All visual design, copy, imagery, and code must be original to Handyman Services; Urban Company is a UX/IA reference only, never a content or asset source (client's explicit instruction, §1 and §25 of the request).

---

## 6. User Roles

| Role | Status |
|---|---|
| **Customer** | Confirmed — browses, searches, books/buys services, has an account |
| **Admin** | Confirmed as a target role; full admin panel build is `[TO BE CONFIRMED — separately scoped]` (§13, §26) |
| **Service Provider** | Confirmed as a target role; dashboard scope is `[TO BE CONFIRMED]` (§14) |

No other roles (e.g., support agent, dispatcher, franchise/city manager) have been mentioned. `[TO BE CONFIRMED]` if any of these are needed.

---

## 7. Customer Journey

```
Land on site
  → Select / confirm city
    → Search OR browse category grid
      → Category → Product/Appliance → Service Type → Service list
        → Service Detail (images, price, description, offers)
          → Add to Cart  ──────────────┐
          → Buy Now ─────┐             │
                          ↓             ↓
                    (login if needed)  Cart (view/adjust items)
                          ↓             ↓
                       Address / Date-Time Selection
                          ↓
                       Order Summary
                          ↓
                       Payment [TO BE CONFIRMED — gateway not yet specified]
                          ↓
                       Order Confirmation
                          ↓
                 Account → Order/Booking history [TO BE CONFIRMED scope]
```

Login can be deferred to the point of checkout (guest browsing/cart, login required to complete an order) — this ordering is `[TO BE CONFIRMED]`; it is the common marketplace pattern but the client has not stated it explicitly.

---

## 8. Admin Journey

```
Admin Login [TO BE CONFIRMED: method]
  → Dashboard
    → City Management (add/edit/enable-disable)
    → Category Management (add/edit/disable, image, order)
    → Product/Appliance Management (add/edit, images, category, active flag)
    → Service Management (add/edit/disable, images, description, MRP,
      offer price, service type, product/appliance, category, city
      availability, active flag)
    → Offer Management (offer text, discount, banner/tile)
```

This journey describes the **data model the frontend must be ready to consume**, per the client's explicit instruction that the admin panel itself is not necessarily being built in this pass (§13, §26). Treat this as the target shape for Phase 2's data architecture, not a Phase-1-scoped UI deliverable.

## 9. Service Provider Journey

```
Provider Login [TO BE CONFIRMED: method]
  → Assigned Jobs list
    → Job Detail (customer, address, date/time, service, status)
      → Update status → Completed
```

Per the client's explicit caution, provider-dashboard specifics beyond this conceptual flow (e.g. an assignment algorithm, live tracking, earnings/payouts, chat with customer) are **`[TO BE CONFIRMED]`**, not assumed scope.

---

## 10. Location / City Architecture

- A city is a first-class, admin-manageable entity (add/edit/enable/disable), not a hardcoded list.
- Service availability is **city-scoped**: the same `Service` record can be available in City A and unavailable in City B. This requires either (a) a many-to-many `Service ↔ City` availability join, or (b) per-city service records referencing a shared "service definition." Recommendation for Phase 2 to evaluate: option (a), a join/availability table, keeps one canonical service record with a list of cities it's offered in — simpler to administer than duplicating service records per city. **Final choice is a Phase 2 data-architecture decision, flagged here, not decided in this document.**
- UX: a city-selection surface (search + a "popular cities" set + a full list) gates or scopes the catalog. The current `LocationSelector` component (free-text, `localStorage`-only) is a UI starting point but has no city list, no availability logic, and no "popular vs. other cities" distinction — this needs to be rebuilt against real city data in Phase 2/3, not just reskinned.
- The initial city list is explicitly **not to be hardcoded as final** — `[TO BE CONFIRMED]`: which cities launch first. (The client's own example flow mentions Ranchi and Patna as illustrative examples, not a confirmed launch list.)

---

## 11. Category Hierarchy

Top-level categories are admin-manageable. Client-mentioned initial groupings (explicitly **not final**, §4 of the client's request):

- **Consumer Durables/Appliances** — AC, Washing Machine, Refrigerator, LED TV/Television, Microwave Oven
- **Kitchen Appliances** — Hob, Gas Stove, Chimney, Dishwasher
- **Water/Air** — RO/Water Purifier, Air Purifier

This maps reasonably closely onto the existing `Category`/`Appliance` records already in the codebase (Cooling, Kitchen Appliances, Water & Heating, Laundry, Entertainment — 5 categories, 12 appliances), which is a useful **content starting point** but will need re-grouping/renaming/extending to match the client's stated groupings and is **not assumed to be final or complete** — new categories must be addable by Admin without frontend changes (client's explicit instruction).

---

## 12. Product/Appliance Hierarchy

Category → Product/Appliance is already modeled today (`Category.applianceIds` → `Appliance` records). This level is directly reusable as a concept; the data will need to be re-populated/extended to match the client's list, and the model needs a new layer underneath it (§13).

---

## 13. Service Hierarchy

**This is the most significant structural gap versus the current system**, and the client explicitly flagged it as one of the most important requirements.

```
Category
  → Product / Appliance
    → Service Type (Installation / Service / Repair / AMC / ...)
      → Individual Service (the actual bookable, priced, detailed item)
```

Today, `Appliance` is effectively a leaf node (it has a description and an icon, but no child services, no service types, no independent pricing, no detail page of its own — appliances currently only appear as list items inside a `Category`'s detail page). This new `ServiceType` → `Service` layer does not exist in the codebase in any form today and is new modeling work for Phase 2, not a refactor of something existing.

---

## 14. Service Types

Client-confirmed minimum set: **Installation, Service, Repair, AMC.**

The data model must treat `serviceType` as an open, data-driven value (a lookup/enum sourced from data, not a hardcoded 4-value TypeScript union), so Admin can introduce types like Uninstallation, Inspection, Consultation, etc., later without a frontend code change. This directly extends the existing "don't hardcode business data in components" principle already used for `Plan`/`Category`/etc.

---

## 15. Service Detail Requirements

Client-specified content for each service detail page:

- Image gallery: 3–5+ images (main + additional)
- Title, detailed description, "what's included"
- Rating/review information — `[TO BE CONFIRMED — no review/rating system exists today; Testimonial exists but is a curated homepage quote, not a per-service review]`
- MRP, offer price, discount (§16)
- Offer/promotional info, an "offers tile"
- Availability (city- and/or slot-based — slot-level availability is `[TO BE CONFIRMED]`, city-level is confirmed per §10)
- Add to Cart, Buy Now, Share

All of the above must be data-driven per-service fields, not hardcoded per the client's explicit instruction (§7–8 of the request).

---

## 16. Pricing Model

Minimum per-service fields: `mrp`, `offerPrice`, `discount`.

Recommendation for Phase 2: store `mrp` and `offerPrice` as the source of truth and **compute** `discount` (percentage and/or absolute) from those two rather than storing it redundantly — this avoids the two numbers going out of sync when Admin edits a price, and mirrors the client's own suggestion ("if discount can be calculated automatically... design the data model accordingly"). Whether discount is ever manually overridden (e.g., a promotional discount not derivable from MRP/offer price alone) is `[TO BE CONFIRMED]`.

Currency: assumed INR (₹), consistent with the existing site and the client's own example figures — not re-confirmed explicitly for the new model but no indication of change.

---

## 17. Cart Requirements

- Multiple services, from potentially different categories/products, in one cart simultaneously (explicit client instruction: "do not assume the cart will always contain only one service").
- Each cart item: service reference, quantity, unit price, line subtotal.
- Cart-level subtotal (and, once tax/fees/discounts are modeled in Phase 2, a total).
- Persistence model (session-only vs. tied to a logged-in customer account vs. both) is `[TO BE CONFIRMED]`.
- The existing `CartButton` component's empty-state modal is a **visual placeholder only** — it has no cart state, no `CartItem` type, and nothing to add items to yet. Building real cart state is new work, not a refactor.

---

## 18. Buy Now Requirements

Single-service express path: Service Detail → Buy Now → (login if not already) → Address → Date/Time → Order Summary → Payment → Order Confirmation.

Per the client's explicit note, **payment gateway integration is treated as a future integration** if not yet specified by the client, but the frontend architecture (order/summary/confirmation screens, and the data shapes behind them) must not preclude adding real payment processing later — i.e., design the checkout flow's data contract now even though the payment step itself is stubbed/deferred.

---

## 19. Login / Authentication Requirements

Customer login is a **confirmed requirement**; the specific method is **`[TO BE CONFIRMED]`** — the client has not stated OTP vs. password vs. social login, and none should be assumed. Candidate customer-account areas (Profile, Addresses, Orders, Cart, Bookings, previous services) are listed by the client as *potential*, not mandatory — each is classified in §39–42 rather than assumed confirmed.

Real authentication (customer, admin, or provider) is explicitly **not being implemented in this phase** — only the architecture needs to accommodate it later.

---

## 20. Search Requirements

Prominent, site-wide search over categories/products/services, generated from the Data Access Layer (mirroring the already-built `SearchBox` component's client-side filtering approach, extended to the new entity set). Must be architected so a future backend/API-based search (e.g., full-text, typo-tolerant, ranked) can replace the client-side filter without changing how components call search — same DAL-seam principle as everything else in this document.

---

## 21. Admin Requirements

Conceptual minimum modules, per client: City Management, Category Management, Product/Appliance Management, Service Management, Offer Management (each with the fields listed in §13 of the client's original request). **The client has explicitly stated the full Admin Panel is not necessarily being built immediately** — Phase 1's job is to make sure the *data architecture* can support these modules later; the Admin UI itself is a separately scoped effort (see §26, §39–42).

---

## 22. Service Provider Requirements

Conceptual minimum: assigned jobs list, job detail (customer, address, date/time, status), status updates, completed-jobs history. Per client instruction, none of this is automatically confirmed scope for building now — see §39–42 and §14.

---

## 23. Data Entities

Proposed entity set (Phase 2 will finalize exact fields/relationships; this is the Phase 1 inventory, distinguishing what already exists from what's new):

| Entity | Status |
|---|---|
| `City` | **New** |
| `Category` | Exists — will need re-scoping/extension |
| `Product` / `Appliance` | Exists — will need a new child relationship to `Service` |
| `Service` | Exists as a type in `src/types/index.ts` but **unused today** — needs to become the central bookable entity |
| `ServiceType` | **New** |
| `ServiceImage` | **New** (today, image is a single optional string field, not a gallery) |
| `Offer` | **New** |
| `Customer` | **New** (no account/profile model exists today) |
| `Address` | **New** |
| `Cart` / `CartItem` | **New** |
| `Order` / `OrderItem` | **New** |
| `ServiceProvider` | **New** |
| `Availability` (city- and/or slot-level) | **New** |
| `Review` | **New** — `[TO BE CONFIRMED whether reviews are in scope]` |
| `Plan` (Silver/Gold/Platinum) | Exists — **status pending client decision**: retained as a parallel subscription offering, or retired in favor of per-service pricing — `[TO BE CONFIRMED]` |
| `Testimonial`, `FAQ`, `ContactInfo`, `HomepageSection`, `NavItem` | Exist — remain useful as-is for their current purpose (homepage social proof, FAQ, contact info, marketing copy, nav) |
| `ServiceLocation` | Exists in code today but is **entirely unused** — superseded by the new `City`/`Availability` model rather than extended |

---

## 24. Data Relationships

```
City 1—* Availability *—1 Service
Category 1—* Product/Appliance
Product/Appliance 1—* ServiceType-instance (i.e., 1—* Service, each Service carrying its own serviceType)
Service 1—* ServiceImage
Service *—* Offer  (an offer can apply to one or many services; exact cardinality is a Phase 2 decision)
Customer 1—* Address
Customer 1—1 Cart 1—* CartItem *—1 Service
Customer 1—* Order 1—* OrderItem *—1 Service
Order 1—1 Address (snapshot at time of order)
Order *—1 ServiceProvider (assigned)
Service 1—* Review *—1 Customer   [TO BE CONFIRMED — depends on §15/§23 review decision]
```

This is a Phase-1-level relationship sketch to validate the requirement, not a finalized schema — Phase 2 will produce the authoritative ER model and TypeScript interfaces.

---

## 25. Frontend Architecture Requirements

- Continue and extend the existing Data Access Layer pattern (`src/lib/data/*`): every new entity above gets its own accessor module, barrel-exported from `src/lib/data/index.ts`, exactly as `plans.ts`/`categories.ts`/etc. work today.
- No component may import JSON (or any future API client) directly — components call accessor functions only. This rule already holds today and must hold for every new entity.
- City-scoping (§10) and cart/session state (§17) introduce **client state** that doesn't exist in the current, fully-static-per-request site — Phase 2 must decide the state-management approach (React context, a client-side store, URL/query-param-driven state, or a combination) rather than bolting this onto the current stateless-page model ad hoc.
- Routing must expand substantially (§36) to support the new hierarchy (city-scoped category/product/service pages, cart, checkout, account, provider areas) — Phase 2 will produce the full route map.

---

## 26. Backend/API Requirements for Future

Not built now. The requirement is that the Data Access Layer's function signatures (e.g., a future `getServices({ cityId, categoryId })`) stay stable while their *implementation* moves from reading local JSON to calling a REST endpoint, WordPress/WooCommerce API, or custom backend — exactly the seam the current README and Phase 2 data-architecture doc already establish for the existing entities, extended to the new ones. No specific backend technology is chosen or assumed in this document.

---

## 27. SEO Requirements

Continue the existing pattern: per-page `generateMetadata`, and `sitemap.ts`/`robots.ts` extended to cover the new city/category/product/service route tree (which will be substantially larger than today's 9-route sitemap). City- and category-scoped URLs (e.g., `/city/category/product`) are typically valuable for local SEO in this business type — confirmed as a *pattern* by the reference-site review (§23 of the client's request), not yet a decided Handyman Services URL scheme (`[TO BE CONFIRMED — exact URL structure is a Phase 2 decision]`).

---

## 28. Responsive Requirements

Every new surface (city selector, category grid, service detail, cart, checkout, account, provider views) must work at mobile/tablet/desktop with no horizontal overflow, continuing the standard already enforced on the current site (which has an explicit, tested fix for a prior mobile-header overflow regression — that discipline carries forward).

## 29. Accessibility Requirements

Continue the current site's standard: semantic HTML, keyboard operability, visible focus states, correct ARIA on interactive/modal elements (the existing header modals — search/location/account/cart — already follow this pattern and are a good template for new modals like cart/checkout steps), and zero automated (axe) violations as a release bar.

## 30. Security Considerations

No secrets, tokens, or payment details are handled by the frontend in this phase. Once real authentication and payment are scoped, standard practice applies: HTTPS-only, no client-side storage of credentials or payment data, server-side session/token validation, and PCI-scope avoidance by delegating card handling to a compliant payment gateway rather than building custom card handling — none of this is being implemented now; it's a constraint for when it is.

## 31. Performance Requirements

Maintain the current site's performance discipline (high-90s/100 Lighthouse scores today) as the catalog grows. Specific new considerations: paginating or virtualizing potentially large service lists per category/city, image optimization for a much larger image inventory (multiple images per service vs. today's single optional image per category/appliance), and avoiding over-fetching when city/category filters change.

---

## 32. Existing Code Reuse Analysis

High-level verdict, detailed in §33–36: the **application shell, data-access pattern, and several header UI components** are genuinely reusable starting points. The **business/catalog data model and the commerce flow (cart, checkout, orders) are new** — this is not a reskin.

## 33. Components to Reuse

- `Header` structural shell, `Footer`, `MobileMenu`, `StickyMobileCTA`, `WhatsAppButton` — layout chrome stays valid.
- `HeaderActionModal` (the shared icon-button + modal pattern) — a solid base to build the cart drawer/checkout-step modals on.
- `SearchBox` — its client-side-filter-over-DAL-data approach is exactly the right pattern for §20, needs to filter the new entity set instead of categories/appliances.
- `Button`, `Container`, `Badge`, `SectionHeading`, `PageHeader` — generic UI primitives, unaffected by the data-model change.
- The Data Access Layer pattern itself (`src/lib/data/index.ts` barrel-export approach) — the architecture, not the specific files, is reused.
- `ContactForm`'s form-state/validation approach — a reasonable template for the checkout address form, though its fields and submit target will change.

## 34. Components to Refactor

- `LocationSelector` — same *concept* (icon → modal → save selection), but needs real city data, search, and a "popular vs. other cities" list instead of free text + `localStorage`.
- `AccountButton` — same shell, needs to become a real (or at least state-aware) login entry point once auth is scoped.
- `CartButton` — same shell, needs real cart state instead of a static empty message.
- `CategoryCard` / `CategoryGrid` — reusable as the visual pattern for category browsing, but need to route into the new Product → Service hierarchy instead of directly into a flat appliance list.
- `ServiceDetailSection` — closest existing analog to the new Service Detail page, but needs a gallery, pricing/discount, rating, Add to Cart/Buy Now/Share added.
- Homepage (`src/app/page.tsx`) — needs restructuring around service discovery (§15 of the client's request: popular categories, featured/most-booked services, offers) rather than the current plan-comparison-centric layout.

## 35. Components to Remove

- `PlanCard` / `PlanComparisonTable` and the `/plans` page — **pending client decision** on whether the Silver/Gold/Platinum subscription model is retained alongside per-service purchases or retired (§23). Not removed by default; flagged for a decision.
- Nothing else is recommended for outright removal — most of the rest is reusable or refactorable, not dead weight.

## 36. New Components Required

City selector (full version), category/product/service hierarchy navigation, service card (catalog-grid item), service image gallery, price/discount/offer display, Add to Cart / Buy Now controls, Cart drawer/page, Cart item row, Checkout steps (address, date/time, summary), Order confirmation, Account area (profile/addresses/orders — scope per §39–42), Login/OTP or password UI (method per §19), Admin-facing components (separately scoped, §26/§39–42), Provider dashboard components (separately scoped, §14/§39–42), Offers tile/banner, Most-booked/featured service rails, Rating/review display (`[TO BE CONFIRMED]`).

## 37. New Routes Required

Indicative only — final route map is a Phase 2 deliverable:

- `/` (redesigned homepage)
- City-scoped category/product/service browsing (exact URL scheme `[TO BE CONFIRMED]`, e.g. `/[city]/[category]`, `/[city]/[category]/[product]`, `/[city]/services/[service-slug]`)
- `/cart`
- `/checkout` (address → schedule → summary, as sub-steps or sub-routes)
- `/order-confirmation/[orderId]`
- `/account`, `/account/orders`, `/account/addresses` (scope per §39–42)
- `/login`
- Retained as-is or revisited per client decision: `/about`, `/faq`, `/contact`, `/privacy`, `/terms`
- Admin and Provider areas — separately scoped, likely a separate app/subdomain rather than routes inside this consumer frontend (`[TO BE CONFIRMED]`)

## 38. Mock Data Requirements

Phase 3 (Implementation) will need representative mock data for: at least a handful of cities, the client's stated categories/products, several services per product across all four confirmed service types (Installation/Service/Repair/AMC) with realistic MRP/offer-price pairs and 3–5 images each, and at least one active offer — enough to demonstrate the full hierarchy and commerce flow end-to-end without real backend data. Exact volume/content is a Phase 3 planning detail, not decided here.

## 39. Future Backend Migration Strategy

Unchanged in principle from the current project's existing strategy (already documented for the current entity set): the Data Access Layer's function signatures are the contract; only their internals move from local JSON to WordPress/WooCommerce/REST/custom-API calls. This document extends that same strategy to the new entities (§23) rather than inventing a new approach.

---

## 40. MUST HAVE

- City selection scoping the catalog (§3, §10)
- Category → Product/Appliance → Service Type → Service hierarchy (§4, §11–14)
- Service detail with images, description, MRP/offer price/discount, Add to Cart, Buy Now, Share (§15–16, §18)
- Cart supporting multiple services (§17)
- Buy Now express flow (§18)
- Site-wide search over the catalog (§20)
- Customer login (method TBC) (§19)
- Data-driven architecture with no hardcoded business data in components (§17 of client request, §25 here)
- Admin-ready data architecture for city/category/product/service/offer management (§21, even though the Admin UI itself is separately scoped)
- Service-provider-ready data architecture (§22, UI separately scoped)

## 41. SHOULD HAVE

- Offers/promotions tile on service detail and homepage (§15, §16)
- Popular/featured/most-booked service rails on the homepage (§15 of client request)
- Account areas: order/booking history, saved addresses (§12/§19 — explicitly listed by client as "potential," treated here as should-have pending confirmation)

## 42. FUTURE

- Real payment gateway integration (§10/§18 — client explicitly defers this)
- Real backend/database/API (§17–18 of client request)
- Full Admin Panel UI (§13, §21, §26)
- Full Service Provider dashboard UI (§14, §22)
- Ratings/reviews system (§15, §23)

## 43. UNKNOWN / CLIENT CONFIRMATION REQUIRED

Explicitly not to be assumed confirmed, per the client's own list plus items surfaced during this analysis:

- OTP vs. password vs. social login (§19)
- Payment gateway choice/integration (§10, §18)
- Exact booking time-slot system / slot-level availability (§10, §15)
- Coupons (distinct from Offers?)
- Wallet
- Refunds and cancellation rules
- Provider assignment algorithm
- Live tracking
- Notifications (email/SMS/push)
- Ratings/reviews (§15, §23, §35)
- Subscriptions — **whether the existing Silver/Gold/Platinum plan model is retained, changed, or retired** (§23, §35) — this is a significant open decision the client should resolve before Phase 2, since it affects both data model and homepage structure
- Exact initial city launch list (§10)
- Exact final category/product/service list beyond the client's illustrative examples (§11–14)
- Account-area exact scope: which of Profile/Addresses/Orders/Cart/Bookings/Previous-services are must-have vs. later (§12, §41)
- Admin authentication method and whether the Admin/Provider areas live inside this same frontend app or as separate applications (§21–22, §37)
- URL/routing scheme for city-scoped pages (§27, §37)

---

## 44. Scope Risks

- **Scope creep risk is high**: this request expands a 4-page marketing site into a full marketplace (catalog + cart + checkout + accounts + admin-ready + provider-ready architecture). Treating all of §21–22 (Admin/Provider) as "must build now" rather than "must be architecturally ready for" would multiply the effort significantly — the client has already drawn this line explicitly, and this document preserves it (§39–43).
- **Business-model ambiguity risk**: the Plan (subscription) vs. per-service-purchase question (§23, §35, §43) affects data model, navigation, and homepage structure. Building against the wrong assumption here would require rework.
- **"Location-first" as a hard gate vs. a filter**: whether the site *requires* a city selection before showing any content (like a modal gate) or treats it as a filter/convenience (browsable without a city, refined once one is picked) changes the homepage and onboarding flow significantly — `[TO BE CONFIRMED]`.

## 45. Technical Risks

- Introducing real client-side state (cart, selected city, login session) into a currently mostly-static/stateless site is a meaningful architectural change, not a small addition — needs a deliberate state-management decision in Phase 2 (§25).
- A much larger, city-scoped route tree changes static-generation strategy: the current site statically generates every route at build time (5 category pages today); a multi-city × multi-category × multi-product × multi-service catalog is unlikely to remain fully statically generated in the same way, and will need a rendering-strategy decision (ISR, on-demand SSR, or client-fetched) once real data volume is known.
- Search (§20) starts as a client-side filter (consistent with today's `SearchBox`) but will not scale indefinitely against a large multi-city catalog — the point at which it needs a real backend/search index is worth flagging early, even though it's out of scope now.
- Image handling grows from "one optional image per category/appliance" to "3–5+ images per service across a large catalog" — asset volume and optimization strategy needs Phase 2 attention.

## 46. Scope/Budget Risk

The gap between "architecture that's ready for Admin/Provider/payments/auth" (this phase's stated goal) and "a fully operating three-sided marketplace" (the client's long-term vision, per §13–14 of the request) is large. The client has already scoped this correctly by deferring Admin UI, real auth, and payments — but it's worth stating plainly: Phase 3 implementation effort for "customer-facing marketplace catalog + cart + checkout UI, architecturally admin/provider-ready" is substantially larger than the original 4-page site, even before any Admin or Provider UI is built. Budget/timeline expectations should be reset against the new scope, not the original one.

---

## 47. Acceptance Criteria (Phase 1)

This Phase 1 document is complete when:

1. The client confirms the Existing System Analysis (§2) is accurate.
2. The client resolves or explicitly defers each item in §43 (Unknown/Client Confirmation Required), especially the Plan/subscription-vs-per-service decision.
3. The client confirms the MUST/SHOULD/FUTURE classification in §40–42, or corrects it.
4. The client acknowledges the scope/technical/budget risks in §44–46.
5. The client explicitly approves proceeding to Phase 2 (System Architecture + Data Architecture + UI/UX Design).

## 48. Phase 1 Completion Checklist

- [x] Existing system inspected and documented from actual code (not assumed) — §2
- [x] New client requirements translated into functional/non-functional requirements — §4–5
- [x] User roles and journeys documented — §6–9
- [x] Location/category/product/service hierarchy specified — §10–14
- [x] Service detail, pricing, cart, buy-now requirements specified — §15–18
- [x] Login, search, admin, provider requirements specified (with unknowns flagged) — §19–22
- [x] Data entities and relationships proposed — §23–24
- [x] Frontend/backend architecture requirements stated — §25–26
- [x] SEO/responsive/accessibility/security/performance requirements stated — §27–31
- [x] Existing code reuse/refactor/remove/new analysis completed — §32–38
- [x] MUST/SHOULD/FUTURE/UNKNOWN classification completed — §39–43
- [x] Risks documented — §44–46
- [ ] **Client review and sign-off — pending**
- [ ] **Phase 2 not started — awaiting approval**

---

*No application code was modified to produce this document. No Admin Panel, authentication, or payment integration has been implemented. No new version has been deployed.*

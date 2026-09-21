# Phase 2 — System Architecture
## Handyman Services Marketplace

**Status:** Phase 2 draft, pending client approval. No code implemented from this document yet.
**Builds on:** `PHASE_1_NEW_REQUIREMENTS_ANALYSIS.md` (approved) and `PHASE_2_DATA_ARCHITECTURE.md` (this document assumes that entity model).

---

## 1. Scope of this document

How the application is structured to support the new marketplace requirements: rendering strategy, client-side state, the city-scoping mechanism, module boundaries, and deployment — extending the existing Next.js foundation rather than replacing it. This document does not cover data shapes (see `PHASE_2_DATA_ARCHITECTURE.md`), page-by-page layout (see `PHASE_2_PAGE_STRUCTURE.md` / `PHASE_2_UI_UX_DESIGN.md`), or component-level detail (see `PHASE_2_COMPONENT_ARCHITECTURE.md`).

## 2. Foundation retained from the existing project

- **Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict), Tailwind CSS v4** — no change. The client's instruction was to use the existing project "as the technical foundation where appropriate," and nothing about the new requirements calls for a different framework.
- **Data Access Layer pattern** (`src/lib/data/*`, barrel-exported) — extended with new modules for the entities introduced in `PHASE_2_DATA_ARCHITECTURE.md`, following the exact existing convention (one module per entity, no component imports JSON/data files directly).
- **Deployment**: Vercel, as today. No deployment changes are made in Phase 2 (client instruction: do not deploy anything yet).
- **Existing content entities** (`Testimonial`, `FAQ`, `ContactInfo`, `HomepageSection`, `NavItem`) keep their current implementation unchanged — they are unaffected by the marketplace re-scope.

## 3. What's structurally new

The current site is, today, essentially **stateless per request**: every page reads mock data and renders; there is no cart, no session, no selected-city concept, and (with 9 routes, 5 of them statically generated) the whole site can be fully static-generated at build time. The marketplace introduces three things the current architecture doesn't have to deal with:

1. **Cross-page client state** — selected city, cart contents, (eventually) login session.
2. **A much larger, data-driven route tree** — city × category × product × service, instead of 5 fixed category pages.
3. **A multi-step flow with side effects** — cart → checkout → order — instead of a single form submit.

Each is addressed below.

## 4. City-scoping mechanism

**Decision:** the selected city is carried in a **URL segment**, not only in client state (e.g. `localStorage` or React context alone). Route shape and rationale are detailed in `PHASE_2_PAGE_STRUCTURE.md`; the architectural point here is *why* a URL-based approach:

- It keeps category/product/service pages server-renderable/statically-generatable per city (a URL segment is available at render time; a `localStorage`-only value is not, since it doesn't exist until the browser runs JS).
- It makes city-scoped pages shareable/bookmarkable and crawlable per city (Phase 1 §27, SEO).
- It matches the general pattern confirmed in the Phase 1 reference-site review (location-specific URLs).

A **client-side "last selected city" convenience** (mirroring today's `LocationSelector`'s `localStorage` behavior) is kept alongside the URL, purely so that navigating to a city-less URL (e.g. the homepage) can redirect or default sensibly — it is a UX convenience layer on top of the URL-based source of truth, not a replacement for it.

**`[TBD]` Multi-city cart behavior — unresolved business rule.** Because the selected city lives in the URL and a customer can navigate between city-scoped URLs within one session, cart items added under different cities are structurally possible. What checkout should do about it — restrict a cart to one city, split checkout into separate orders per city, or apply another rule — is **not decided** here; see `PHASE_2_DATA_ARCHITECTURE.md` §3 (Cart/CartItem) and Open Question #24 (`PHASE_2_OPEN_QUESTIONS.md`). This document does not assume an answer.

**Open question carried from Phase 1 (§44):** whether city selection *gates* the site (nothing browsable without picking a city first) or *scopes* it (browsable, refined once picked). This document assumes the latter (scoping, not gating) as the lower-risk default consistent with the reference site's pattern (categories are visible before a specific city's availability is checked), but this is flagged for explicit client confirmation before Phase 3, not decided unilaterally.

## 5. Client-side state management

**Decision:** React Context + `localStorage` persistence for cart and selected-city, consistent with the lightweight approach the current codebase already uses (the existing `LocationSelector` already does simple `localStorage` read/write in a `try/catch`). No external state-management library (Redux/Zustand/etc.) is introduced — the state surface (cart contents, selected city, transient UI state) is small enough that Context is sufficient and keeps the dependency footprint unchanged.

- `CartProvider` — holds cart items, exposes add/update/remove/clear, persists to `localStorage` (mirrors `Cart`/`CartItem` shape from the data architecture), so a cart survives a page reload without requiring login (pending the guest-cart-vs-login-first decision, Phase 1 §43). It does not currently enforce any single-city restriction on cart contents — whether it should is the unresolved question noted in §4 above.
- `LocationProvider` — holds the "last selected city" convenience value described in §4.
- Server-rendered pages read the *URL* for city-scoping (§4); client components additionally read `LocationProvider` for cross-page convenience (e.g. pre-filling the city selector, redirecting `/ ` → `/[city]`).
- Login/session state is **not designed here** — it depends entirely on the still-TBD auth method (Phase 1 §19) and would be invented if specified now.

## 6. Rendering strategy

| Route type | Strategy | Rationale |
|---|---|---|
| Marketing pages (About/FAQ/Contact/Privacy/Terms, homepage shell) | Static (as today) | Content changes rarely; no city-scoping needed |
| City → Category → Product → Service catalog pages | **Incremental Static Regeneration (ISR)**, not full build-time static generation | The current site fully statically generates all 5 category pages at build time because the catalog is tiny and fixed; a multi-city catalog is neither (Phase 1 §45 flagged this risk directly). ISR lets these pages stay fast and cacheable while periodically re-rendering from the underlying data source on a schedule (`revalidate`), rather than only at build time — a better fit for a much larger route tree than full static generation. **`[Clarified]`** In Phase 3's actual scope (mock JSON + Data Access Layer, no Admin UI, no real backend), a catalog content change still follows the normal development/build/deployment process like any other code or data change — ISR does not make mock-JSON content editable or "live" on its own. ISR's practical benefit today is scaling page generation across a larger route tree, not admin-editability. If/when a real backend/Admin exists in the future, ISR/ revalidation *can* support backend-driven catalog changes appearing without a manual frontend rebuild — but that depends on that future backend's implementation and is not something Phase 3 delivers |
| Cart, checkout, order confirmation | Client-rendered / dynamic | Inherently session-specific, not cacheable across users |
| Account, provider areas (when built) | Dynamic, auth-gated | Depends on the auth decision; not built in Phase 3 per client scope |

This directly resolves the "will everything stay statically generated" risk flagged in Phase 1 §45 with a concrete, low-risk answer (ISR) rather than leaving it open.

## 7. Module boundaries

```
src/
  app/                 Routes (Phase 2 route map in PHASE_2_PAGE_STRUCTURE.md)
  components/          UI (Phase 2 detail in PHASE_2_COMPONENT_ARCHITECTURE.md)
  lib/
    data/              Data Access Layer — one module per entity (PHASE_2_API_CONTRACT.md)
    state/             NEW — CartProvider, LocationProvider (client Context)
    pricing.ts         NEW — shared discount-calculation helper (single source of truth for
                        the mrp/offerPrice → discount math, used by both service cards and
                        service detail so the figure is never computed twice, inconsistently)
  types/               Shared TypeScript types (extended per PHASE_2_DATA_ARCHITECTURE.md)
  data/                Mock JSON (extended with new entity files)
```

This is an **extension** of the existing folder structure, not a restructure — every top-level folder that exists today keeps its purpose.

## 8. Search architecture

Client-side filtering over Data Access Layer data, extending the existing `SearchBox` pattern to the new entity set (categories, products, services) — consistent with Phase 1 §20's requirement that search be backend-ready but not backend-dependent yet. As the catalog grows (§6's ISR note applies here too), a real search backend becomes worth revisiting, but that is explicitly future work, not designed further here.

## 9. Non-functional carry-forward

Accessibility, performance, and responsive discipline (Phase 1 §28–31) are architectural constraints applied to every new module above, not a separate workstream — e.g. `CartProvider`'s cart-drawer UI must meet the same modal-accessibility pattern the existing header modals already establish (used as the template in Phase 1 §33).

## 10. Explicitly not addressed in Phase 2

Per the client's instructions: no Admin Panel implementation, no real authentication implementation, no real payment integration, no deployment. This document establishes that the architecture *accommodates* these (a stable Data Access Layer contract, a `Customer`/`ServiceProvider` shape, an `Order.paymentStatus` field) without building any of them now.

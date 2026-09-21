# Phase 2 — Data Architecture
## Handyman Services Marketplace

**Status:** Phase 2 draft, pending client approval. No code implemented from this document yet.
**Builds on:** `PHASE_1_NEW_REQUIREMENTS_ANALYSIS.md` (approved baseline) — this document is the finalized (Phase-2-level) data model that Phase 1's §23–24 sketched at a conceptual level.
**Scope note:** Entities/fields marked `(TBD)` support a Phase-1-unconfirmed feature (§5 of the client's approval) and are included so the shape exists, but are not required to be populated or fully functional until that feature is confirmed.

---

## 1. Design principles (carried from the existing project, extended)

1. **No component reads business data directly.** Every entity below is read exclusively through a Data Access Layer function (see `PHASE_2_API_CONTRACT.md`). This is the same rule the current codebase already enforces for `Plan`/`Category`/etc., extended to every new entity.
2. **Mock data now, same shape later.** Every entity's fields are chosen so a future WordPress/WooCommerce or custom API can populate the identical shape — no field is designed "for mock convenience only."
3. **City-availability is a relationship, not a duplicated record.** A `Service` exists once; which cities it's offered in is expressed as a separate availability relationship (§4), so Admin never has to maintain N copies of the same service for N cities.
4. **Discount is computed, not duplicated.** `mrp` and `offerPrice` are the stored source of truth; discount percentage/amount is derived (§4, Service), per the client's own suggestion in Phase 1.
5. **Open-ended lookups over hardcoded unions.** `ServiceType` is a data-driven list (id/key/label), not a fixed 4-value TypeScript union — so Admin can add a 5th service type later without a frontend code change.

---

## 2. Entity summary

| Entity | Purpose | Phase 1 status |
|---|---|---|
| `City` | A serviceable location | New |
| `Category` | Top-level grouping (e.g. Consumer Durables) | Exists, extended |
| `Product` | An appliance/product within a category (renamed from today's `Appliance`) | Exists, extended |
| `ServiceType` | Installation / Service / Repair / AMC / future types | New |
| `Service` | The bookable, priced, detailed catalog item | Exists as an unused type; now the central entity |
| `ServiceCityAvailability` | Which cities a service is offered in | New |
| `ServiceImage` | Gallery image for a service | New |
| `Offer` | Promotional discount/banner | New |
| `Customer` (TBD auth) | A logged-in shopper | New |
| `Address` | A saved or order-time delivery address | New |
| `Cart` / `CartItem` | In-progress selection before checkout | New |
| `Order` / `OrderItem` | A placed booking | New |
| `ServiceProvider` (TBD auth) | A technician/fulfillment partner | New |
| `Review` (TBD scope) | Per-service rating/feedback | New |
| `Plan` | Legacy Silver/Gold/Platinum subscription | Exists — **LEGACY / PENDING CLIENT DECISION**, retained in the model but excluded from the primary catalog architecture per the client's Phase 1 approval (§4) |
| `Testimonial`, `FAQ`, `ContactInfo`, `HomepageSection`, `NavItem` | Existing marketing/support content | Exists, unchanged in shape |
| `ServiceLocation` | Old, unused location type | **Removed / superseded by `City`** |

---

## 3. Entity definitions

### City

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `name` | string | e.g. "Ranchi" |
| `state` | string | |
| `slug` | string | URL-safe identifier |
| `isPopular` | boolean | drives the "Popular Cities" vs "Other Cities" UI split (Phase 1 §10) |
| `active` | boolean | Admin enable/disable |
| `sortOrder` | number | |

No city is hardcoded as the launch list — this table is empty of real content until the client confirms cities (Phase 1 §43).

### Category

| Field | Type | Notes |
|---|---|---|
| `id`, `slug`, `name`, `description`, `icon`, `image` | — | same shape as today's `Category`, image now expected populated (was optional/nullable) |
| `sortOrder`, `active` | — | |

### Product

(Renamed conceptually from today's `Appliance`; existing `Appliance` records are a content starting point, re-scoped per Phase 1 §11–12.)

| Field | Type | Notes |
|---|---|---|
| `id`, `slug`, `name`, `description`, `icon`, `image` | — | same shape as today's `Appliance` |
| `categoryId` | string | FK → `Category` |
| `sortOrder`, `active` | — | |

### ServiceType

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `key` | string | machine key, e.g. `installation`, `service`, `repair`, `amc` |
| `label` | string | display label |
| `sortOrder`, `active` | — | |

Seeded with the four client-confirmed types; Admin can add more (Phase 1 §14).

### Service

The central new entity.

| Field | Type | Notes |
|---|---|---|
| `id`, `slug` | string | |
| `productId` | string | FK → `Product` |
| `serviceTypeId` | string | FK → `ServiceType` |
| `name` | string | e.g. "AC Installation — Split, 1.5 Ton" |
| `shortDescription` | string | for catalog/list cards |
| `description` | string | full detail-page copy |
| `whatsIncluded` | string[] | bullet list |
| `images` | `ServiceImage[]` | 3–5+ (§4 client requirement) |
| `mrp` | number | |
| `offerPrice` | number | |
| `discountPercent` | number (derived) | `round((1 − offerPrice/mrp) × 100)` |
| `discountAmount` | number (derived) | `mrp − offerPrice` |

**`[TBD]` Offer interaction:** this derived discount comes only from `mrp`/`offerPrice`. Whether an applicable `Offer` (below) stacks with, replaces, or otherwise interacts with this figure is **not decided** — see the `Offer` entity note and Open Question #25. Nothing in this document should be read as implying the two combine automatically.
| `ratingAverage` (TBD) | number \| null | populated only if/when reviews are in scope |
| `ratingCount` (TBD) | number | |
| `availableCityIds` | string[] (derived from `ServiceCityAvailability`) | convenience accessor, not stored redundantly |
| `active` | boolean | |
| `sortOrder` | number | |

Discount is **computed at read time** by the Data Access Layer (principle §1.4), not stored, so editing `mrp`/`offerPrice` in Admin can never leave a stale discount value.

### ServiceCityAvailability

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `serviceId` | string | FK → `Service` |
| `cityId` | string | FK → `City` |
| `active` | boolean | allows temporarily pausing a service in one city without deleting the relationship |

This is the mechanism behind Phase 1 §10's requirement ("a service available in one city but unavailable in another").

### ServiceImage

| Field | Type | Notes |
|---|---|---|
| `id`, `serviceId`, `url`, `alt`, `sortOrder` | — | mirrors the existing single-`image`-field pattern used elsewhere in the app, extended to a list |

### Offer

| Field | Type | Notes |
|---|---|---|
| `id`, `title`, `description` | string | |
| `discountType` | `"percent" \| "flat"` | |
| `discountValue` | number | |
| `appliesTo` | `{ scope: "all" \| "category" \| "service"; ids: string[] }` | which services/categories the offer applies to |
| `bannerImage` | string \| null | for the "offers tile" (Phase 1 §15–16) |
| `startDate`, `endDate` | string \| null (TBD whether time-bounding is required) | |
| `active` | boolean | |

Coupon codes are explicitly **not** part of this entity — coupons are a separately flagged TBD item (Phase 1 §43) and, if confirmed later, are modeled as their own entity rather than folded into `Offer`.

**`[TBD]` Precedence with `Service.offerPrice`:** `Service` already carries its own `mrp`/`offerPrice`-derived discount (§3, Service). Whether a matching `Offer` stacks on top of that discount, overrides it, or is mutually exclusive with it has **not** been confirmed by the client. This document deliberately does not pick one — see Open Question #25 (`PHASE_2_OPEN_QUESTIONS.md`). Phase 3 must not implement automatic stacking/combination of the two without that confirmation.

### Customer *(TBD — depends on login-method decision)*

| Field | Type | Notes |
|---|---|---|
| `id`, `name`, `phone`, `email` | — | minimum shape regardless of auth method |
| `addressIds` | string[] | → `Address` |

Authentication fields (password hash, OTP session, social-login identifiers) are deliberately **not** specified here — they depend entirely on the login-method decision (Phase 1 §19, still TBD) and would be invented if defined now.

### Address

| Field | Type | Notes |
|---|---|---|
| `id`, `customerId` (nullable — a guest checkout may create an address without a saved customer, TBD), `label`, `line1`, `line2`, `city`, `state`, `pincode`, `isDefault` | — | mirrors the existing `ContactForm`'s address fields, restructured as a reusable, saveable entity |

### Cart / CartItem

| Field | Type | Notes |
|---|---|---|
| `Cart.id` | string | |
| `Cart.customerId` \| `Cart.sessionId` | string | supports guest carts (TBD whether guest carts are in scope, or login-before-cart — Phase 1 §7) |
| `Cart.items` | `CartItem[]` | |
| `CartItem.id`, `.serviceId`, `.quantity`, `.unitPriceAtAdd` | — | price is snapshotted at add-time so a later price change doesn't silently alter an existing cart — standard e-commerce practice, not a client-stated requirement, flagged as a Phase 2 design decision |

**`[TBD]` Multi-city cart behavior — unresolved business rule.** Each `CartItem` resolves to a `Service`, and `Service` availability is city-scoped (`ServiceCityAvailability`, §4 below) — so, structurally, a cart's items can each carry their own city context. What is **not** decided is what happens if a customer adds a service while browsing City A, then switches to City B and adds another service: whether one cart is restricted to a single city, whether checkout splits into separate orders per city, or whether another rule applies. No option is assumed here. See Open Question #24 (`PHASE_2_OPEN_QUESTIONS.md`); this must be resolved before Phase 3 builds cart/checkout logic.

### Order / OrderItem

| Field | Type | Notes |
|---|---|---|
| `Order.id` | string | |
| `Order.customerId` | string \| null (TBD) | **Reconciled with `PHASE_2_API_CONTRACT.md` §5's `createOrder()`, which takes `customerId` as optional.** Whether guest checkout is in scope is not yet decided (Open Question #17); until it is, `Order.customerId` is modeled as nullable/optional here, not required, so this document does not imply an authentication requirement that hasn't been confirmed |
| `Order.items` | `OrderItem[]` | How checkout resolves a service's city when a cart contains items added under different cities is unresolved — see the Cart/CartItem note above and Open Question #24. Not designed further until that is confirmed |
| `Order.address` | `Address` (snapshot, not a live FK) | so a later address edit doesn't rewrite history |
| `Order.scheduledDate` | string | |
| `Order.scheduledSlot` (TBD) | string \| null | depends on the slot-system decision (Phase 1 §43) |
| `Order.subtotal`, `.discountTotal`, `.total` | number | |
| `Order.status` | string (open lookup: `pending`, `confirmed`, `assigned`, `in_progress`, `completed`, `cancelled` — exact lifecycle TBD) | |
| `Order.providerId` (TBD) | string \| null | set once an order is assigned |
| `Order.paymentStatus` (TBD) | string | depends entirely on the payment-gateway decision |
| `Order.createdAt` | string | |
| `OrderItem.id`, `.serviceId`, `.quantity`, `.unitPrice`, `.lineTotal` | — | |

### ServiceProvider *(TBD — dashboard scope and auth method both open)*

| Field | Type | Notes |
|---|---|---|
| `id`, `name`, `phone` | — | minimum shape |
| `assignedOrderIds` | string[] | |

### Review *(TBD — whether reviews are in scope at all)*

| Field | Type | Notes |
|---|---|---|
| `id`, `serviceId`, `customerId`, `rating` (1–5), `comment`, `createdAt` | — | shape only; not built unless confirmed |

### Plan *(LEGACY / PENDING CLIENT DECISION)*

Unchanged from the existing `Plan` type. Retained in the data model exactly as-is so no data is lost, but **excluded from the primary catalog/homepage architecture** per the client's Phase 1 approval. If the client later confirms Plans stay active, Phase 2's page-structure and homepage design would need a follow-up addendum — not assumed now.

---

## 4. Relationships (entity-relationship overview)

```
City 1───* ServiceCityAvailability *───1 Service
Category 1───* Product
Product 1───* Service
ServiceType 1───* Service
Service 1───* ServiceImage
Service *───* Offer            (via Offer.appliesTo)
Service 1───* Review           [TBD]
Customer 1───* Address         [TBD — auth]
Customer 1───1 Cart 1───* CartItem *───1 Service   [TBD — guest vs. logged-in cart; city context per item, checkout resolution TBD — see Open Question #24]
Customer 1───* Order          [TBD — Order.customerId nullable/optional pending guest-checkout decision, Open Question #17]
Order 1───* OrderItem *───1 Service
Order 1───1 Address (snapshot)
Order *───1 ServiceProvider    [TBD]
```

This directly formalizes the sketch already presented and approved at Phase 1 (§24).

---

## 5. City-availability: why a join relationship, not duplicated records

Phase 1 (§10) flagged two options: (a) one canonical `Service` record with a list of cities it's offered in, or (b) a per-city copy of each service. This document adopts **(a)**, `ServiceCityAvailability`, because:

- Editing a service's price/images/description once updates it everywhere it's offered — no risk of city copies drifting out of sync.
- Admin's "add a city to an existing service" action becomes a single new join row, not a full service duplication.
- It matches how the reference platform's general pattern works (services scoped by location without separate catalogs per city) — confirmed structurally in Phase 1's IA review, not copied from it.

---

## 6. Mock data strategy (Phase 3 planning note, not implemented here)

Phase 3 will need mock data populated for every entity above (excluding the TBD-gated ones, which can remain empty/unbuilt), sized enough to demonstrate the full hierarchy: a handful of cities, the client's stated categories/products, several services per product across all four confirmed service types, realistic MRP/offer-price pairs, 3–5 images per service, and at least one active offer. This restates Phase 1 §38 and is not expanded further here — exact volumes are a Phase 3 decision.

---

## 7. Migration path to a real backend

Unchanged in principle from the existing project's approach (and from Phase 1 §26/§39): every entity above is consumed only through Data Access Layer functions (`PHASE_2_API_CONTRACT.md`). Moving from local mock JSON to WordPress/WooCommerce, a REST API, or a custom backend means changing the *implementation* of those functions only — no page or component changes. Nothing about this data model assumes or depends on a specific backend technology.

---

## 8. Explicitly out of scope for this document

Database engine choice, ORM/schema migrations, indexing strategy, and API authentication/authorization mechanics are backend implementation concerns, not frontend data architecture — they are not decided here and are correctly deferred per the client's Phase 1 direction (real backend is future work).

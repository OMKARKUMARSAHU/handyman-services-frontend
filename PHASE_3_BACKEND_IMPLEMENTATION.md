# Phase 3 — Backend Implementation

Status: **implementation complete, verified locally, and stopped per the brief's waterfall rule** — awaiting explicit approval before any of: production deployment, AWS infrastructure provisioning, frontend integration, Phase 4 QA, payment gateway integration, or DNS cutover.

This document is the source of truth for what was actually built in Phase 3, as opposed to what Phase 2 designed. Where an implementation detail required a concrete decision Phase 2 left open, that decision is called out explicitly as a **flagged decision** rather than silently assumed.

**PHASE 3 CORRECTION (applied after the initial implementation below):** the Offer and pricing model described in §8/§9/§10 was corrected per an authoritative follow-up brief. The final, binding rules are: an Offer is either **ALL_INDIA** (applies nationwide) or **CITY** (applies to exactly one named city) — never both, never neither; when both tiers have a matching offer for the same service/city, the **CITY offer always wins** and the two are never stacked; and a service's own mrp/offerPrice discount **now combines** with the one effective Offer (superseding the original "never combined, Open Question #25 TBD" position below, which is now resolved). §8/§9/§10/§15/§17 below have been rewritten to reflect this; nothing in §1–§7, §11–§14, §16, §18 changed. See the correction's own detail inline in each affected section.

All work lives in `backend/` (cloud workspace mirror: `/home/claude/handyman-app/backend`; device path: `C:\Projects\Handyman\backend`). Nothing in `src/` (the existing Next.js frontend) was modified except where explicitly noted in §12.

---

## 1. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Language / runtime | TypeScript (strict mode) on Node.js 22 | `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true` |
| HTTP framework | Express 4 | `src/app.ts` / `src/server.ts` |
| SQL / migrations | Knex.js + `mysql2` driver | `src/database/` |
| Database | MySQL 8, InnoDB | Local disposable instance in this phase — see §16 |
| Auth verification | `aws-jwt-verify` (`CognitoJwtVerifier`) | `src/modules/auth/verifier.ts` |
| Validation | `zod` | one schema file per module |
| Security middleware | `helmet`, `cors`, `express-rate-limit` | `src/app.ts`, `src/middleware/rateLimit.ts` |
| Logging | `pino` (structured JSON) | `src/shared/logger.ts` |
| S3 | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | `src/modules/media/media.service.ts` |
| Testing | `jest` + `ts-jest` + `supertest` | `tests/` — see §15 |
| Linting | ESLint 8 (`@typescript-eslint`) | `.eslintrc.json` — see the flat-config note in §17 |

No dependency was added beyond what `package.json` already declared at the start of this phase.

---

## 2. Project structure

```
backend/
  src/
    config/env.ts                  # zod-validated environment config (single source of truth)
    database/
      db.ts                        # getDb()/closeDb() — one knex singleton per process
      knexfile.ts                  # development/test/production profiles
      migrations/                  # 11 migrations — see §3
      seeds/                       # empty — no seed data was created (see §17)
    middleware/
      requestId.ts  authenticate.ts  authorize.ts  errorHandler.ts  validate.ts  rateLimit.ts
    modules/
      auth/          roles.ts, types.ts, verifier.ts
      cities/        categories/  products/  service-types/   # simple catalog CRUD, same pattern
      services/      # the core, most complex module — approval workflow lives here
      availability/  # service_city_availability join-table upsert
      approvals/     # the ONE shared admin approval queue routes
      providers/     customers/  addresses (inside customers/)
      cart/          orders/
      offers/        search/
      media/         # S3 pre-signed upload flow
      content/       # testimonials, faqs, homepage sections, contact info, branding, nav items, plans
      users/         # generic role-aware GET /me
      admins/        # intentionally empty — see NOT_IMPLEMENTED.md inside it
      payments/      # intentionally minimal — see NOT_IMPLEMENTED.md inside it
    routes/index.ts  # buildRouter() — aggregates every module's router, no route logic of its own
    shared/          errors.ts  response.ts  pricing.ts  logger.ts  asyncHandler.ts
    app.ts           # createApp() — Express assembly, importable by tests without a real socket
    server.ts        # main() — binds a port, DB ping, graceful shutdown
  tests/
    helpers/         # cognitoTestKit.ts, db.ts, factories.ts, testApp.ts, jest.setup.ts
    modules/         # 10 suites, 62 tests — see §15
  package.json  tsconfig.json  jest.config.js  .eslintrc.json  .env.example  .gitignore
```

Every module that needed one follows the same file split: `<module>.types.ts` (DTO + Row + mapper), `<module>.service.ts` (business logic, all DB access), `<module>.schema.ts` (zod request validation), `<module>.routes.ts` (Express router — thin, delegates to the service). No business logic is duplicated across modules; where two modules need the same read (e.g. cart and orders both need a service's live price), the *owning* module exports a function the other calls (`services.service.ts`'s `getServiceRowById` / `isServicePurchasableInCity`) rather than re-querying the table itself.

---

## 3. Database implementation

13 Knex migrations, applied in order, each with a matching reversible `down()` (11 from the original implementation, plus 2 from the Offer/pricing correction):

1. `create_catalog_lookup_tables` — `cities`, `categories`, `products`, `service_types`
2. `create_customers_and_providers` — `customers`, `service_providers` (new; the mock frontend never needed real identity rows)
3. `create_services` — the core entity, extended with the approval-workflow columns (§7)
4. `create_service_city_availability_and_images` — `service_city_availability`, `service_images`
5. `create_offers`
6. `create_addresses`
7. `create_carts_and_cart_items` — authenticated-customer-only, per the finalized checkout flow
8. `create_orders_and_order_items` — `customer_id NOT NULL`; address and pricing are snapshotted columns
9. `create_payments` — generic, gateway-agnostic boundary (§17)
10. `create_content_tables` — `testimonials`, `faqs`, `contact_info`, `homepage_sections`, `nav_items`, `branding`
11. `create_plans_legacy` — unmodified legacy entity, per the client's existing "pending decision" note
12. `add_offer_applicability` — **PHASE 3 CORRECTION**: adds `applicability_type` (`all_india`/`city`), `city_id` (nullable FK → `cities.id`, `ON DELETE RESTRICT`), a DB-level `CHECK` constraint enforcing the two are never set inconsistently, and a plain auto-increment `seq` column used only as a deterministic tie-breaker when resolving the one effective Offer (§8). Purely additive — every existing/new row defaults to `applicability_type = 'all_india'`, `city_id = NULL`, which is the only reading consistent with a schema that previously had no city column on `offers` at all; no row is modified destructively.
13. `add_order_item_pricing_breakdown` — **PHASE 3 CORRECTION**: adds `mrp_snapshot`, `service_offer_price_snapshot`, `service_discount_amount`, `effective_offer_id` (nullable FK, `ON DELETE SET NULL`), `effective_offer_name_snapshot`, `effective_offer_applicability_type_snapshot`, `offer_discount_amount`, `total_discount_amount` to `order_items`, so a historical order's full pricing breakdown — not just its final price — survives both a later service-price edit and the referenced Offer being changed or deleted. `unit_price`/`line_total` keep their existing meaning (the final price actually charged) and column names. Any pre-existing `order_items` rows (none in the real RDS instance — see §16 — only disposable local rows elsewhere) have `mrp_snapshot`/`service_offer_price_snapshot` best-effort backfilled from the already-stored `unit_price`, the only historically-known figure for a row created before this correction.

Conventions followed throughout: `UUID CHAR(36)` primary keys (generated in application code via `crypto.randomUUID()`, never `AUTO_INCREMENT`); `DECIMAL(10,2)` for every monetary column; explicit foreign keys with an `onDelete` policy chosen per relationship (`CASCADE` for a table that only exists as a child of its parent, e.g. `cart_items` → `carts`; `RESTRICT` where deleting the parent while children exist should be an error, e.g. `products` referenced by `services`); `t.timestamps(true, true)` everywhere; raw `CHECK` constraints for numeric-range/positivity rules Knex's fluent API doesn't expose directly (`services.mrp >= 0`, `cart_items.quantity > 0`, `order_items.quantity > 0`, `testimonials.rating BETWEEN 1 AND 5`).

**Passwords, image/video binaries, and AWS credentials are never stored in MySQL** — Cognito is the password store, S3 holds media bytes (MySQL only ever holds a URL reference to them), and AWS credentials live in environment variables / the ECS task's IAM role, never a table.

Migration validation performed (see §16 for the full safety discussion): `migrate:latest` → `migrate:rollback --all` → `migrate:latest` again (clean, idempotent re-apply) → `migrate:status` (all 11 completed, none pending), against **two** disposable local MySQL databases (`handyman_dev`, `handyman_test`) — never against the real RDS `database-1` instance.

---

## 4. Authentication implementation

One shared Cognito User Pool, exactly as it already exists — no new pool created, no existing configuration modified. `src/modules/auth/verifier.ts` builds a single `CognitoJwtVerifier` (`tokenUse: "access"`, `clientId` accepting both the customer app client and the shared admin/provider app client), built lazily so a `COGNITO_USER_POOL_ID`-less environment (like this sandbox) doesn't crash at import time — only an actual authenticated request fails, with a clear error.

`src/middleware/authenticate.ts` is the only place a bearer token is parsed and verified:

1. Requires an `Authorization: Bearer <token>` header — missing/malformed → `401 UNAUTHENTICATED`.
2. Delegates signature/issuer/audience/`token_use`/expiry verification entirely to `aws-jwt-verify` — nothing here reimplements JWT verification.
3. Reads the role from the verified `cognito:groups` claim (never anything the client could otherwise influence) — a token with no recognized group → `403 FORBIDDEN` ("not assigned to a recognized role"), a genuinely invalid/expired/wrong-signature/wrong-issuer/wrong-audience token → `401 UNAUTHENTICATED`.
4. Populates `req.auth = { sub, role, claims }`.

`optionalAuthenticate()` exists (never rejects, just leaves `req.auth` unset on failure) but no current route needs it, since every route is either fully public or fully authenticated — kept available rather than duplicating the token-parsing logic if a future route needs it.

**Customer signup/signin/forgot-password/reset/email-verification themselves are Cognito Hosted UI / Cognito SDK flows on the frontend, not backend endpoints** — the backend's job starts at "here is a bearer token, tell me who this is," which is exactly what `authenticate()` does. This matches the finalized flow: Browse → Cart → **Customer Login/Signup (via Cognito, frontend-driven)** → Checkout → Create Order.

---

## 5. Authorization implementation

Three composable middleware, applied per-route in whatever combination that route needs:

- **`authenticate()`** (§4) — steps 1–3 of the pipeline: verify the token, establish identity, extract role.
- **`requireRole(...roles)`** (`src/middleware/authorize.ts`) — declarative role gate. `403` if `req.auth.role` isn't one of the listed roles. Used on every `/admin/*`, `/provider/*`, `/customer/*` route.
- **`requireOwnership(resolveOwnerSub)`** — resource-ownership check. `resolveOwnerSub(req)` looks up the target resource and returns the Cognito `sub` of whoever owns it (or `null` if the resource doesn't exist at all). A `null` → `404` (so a non-owner can't use this check to learn whether a resource exists); a resolved sub that doesn't match `req.auth.sub` → `403`; a match → `next()`. Used on `/provider/listings/:id`, `/customer/addresses/:id`, `/customer/orders/:id`, and inside `media.service.ts`'s combined admin-or-provider check.

**The frontend's UI is never trusted as an authorization signal.** Every private endpoint re-derives the caller's role and ownership from the verified token on every request — confirmed by `authorization.test.ts`'s explicit "a spoofed `X-User-Role` header changes nothing" case.

Media routes (`/media/upload-url`, `/media/:serviceId/images`, `/media/images/:id`) are the one place Admin and Provider share a single route rather than separate `/admin/...` / `/provider/...` prefixes, because the API contract itself defines them that way ("Admin, or Provider +ownership"). `requireAdminOrProvider()` is a small local declarative gate; the finer rule — a Provider may only touch media on their *own*, and only *pending/rejected* (never already-`approved`), listing — is enforced inside `media.service.ts`'s `assertCanManageServiceMedia()`, since it needs to load the target service to decide.

---

## 6. API implementation

REST, under `/api/v1` (`env.API_BASE_PATH`), following `PHASE_2_BACKEND_API_CONTRACT.md` as source of truth — no endpoint was invented that isn't either in that contract or an explicit, named requirement of the Phase 3 brief itself (media, admin content/branding, and the generic `/me` were all already specified in the contract; see §17 for the offers/search filtering nuances that went slightly beyond the contract's one-line description).

**81 endpoints** across 15 route modules (plus `GET /health`, outside the API base path) — 79 from the original implementation, plus `GET /admin/offers` and `GET /admin/offers/:id` added by the Offer/pricing correction (§8) to satisfy its explicit "Admin must be able to READ offers" requirement, which the public, city-scoped `GET /offers` cannot serve on its own:

```
GET    /health

GET    /cities                                   POST   /admin/cities                       PATCH  /admin/cities/:id
GET    /cities/:slug

GET    /categories                               POST   /admin/categories                    PATCH  /admin/categories/:id
GET    /categories/:slug
GET    /categories/:categorySlug/products
GET    /categories/:categorySlug/products/:productSlug

                                                  POST   /admin/products                       PATCH  /admin/products/:id

GET    /service-types                            POST   /admin/service-types                  PATCH  /admin/service-types/:id

GET    /services                                 POST   /admin/services                       PATCH  /admin/services/:id
GET    /services/:slug                                                                        PUT    /admin/services/:id/city-availability

                                                  GET    /admin/listings/pending
                                                  POST   /admin/listings/:id/approve
                                                  POST   /admin/listings/:id/reject

GET    /provider/me           PATCH /provider/me
GET    /provider/listings     POST  /provider/listings
GET    /provider/listings/:id PATCH /provider/listings/:id
                                                  GET    /admin/providers                       PATCH  /admin/providers/:id

GET    /customer/me           PATCH /customer/me
GET    /customer/addresses    POST  /customer/addresses
PATCH  /customer/addresses/:id  DELETE /customer/addresses/:id
                                                  GET    /admin/customers                       PATCH  /admin/customers/:id

GET    /customer/cart         POST  /customer/cart/items      PATCH /customer/cart/items/:id
DELETE /customer/cart/items/:id                  POST  /customer/cart/merge

POST   /customer/orders       GET   /customer/orders          GET   /customer/orders/:id
                                                  GET    /admin/orders                          PATCH  /admin/orders/:id

GET    /offers                                   POST   /admin/offers                          PATCH  /admin/offers/:id
                                                  GET    /admin/offers                          GET    /admin/offers/:id

GET    /search

POST   /media/upload-url
POST   /media/:serviceId/images
DELETE /media/images/:id

GET    /testimonials          GET /faqs         GET /homepage-sections    GET /contact-info
GET    /branding              GET /nav-items    GET /plans
                                                  admin CRUD for all of the above (see routes/index.ts)

GET    /me
```

Every response uses the consistent envelope (`src/shared/response.ts`): `{ success: true, data, meta? }` on success, `{ success: false, error: { code, message, details? }, requestId }` on failure (`src/middleware/errorHandler.ts`). Pagination (`page`/`pageSize`, capped at 100) and filtering follow the exact query-parameter names `PHASE_2_BACKEND_API_CONTRACT.md` §Filtering/pagination table specifies for each endpoint.

---

## 7. Approval workflow implementation

Implemented exactly as the brief mandates, with no reinterpretation:

- `services.approval_status` is one of `pending_approval | approved | rejected`; `services.created_by_role` is `admin | provider`; `services.created_by_user_id` stores the creator's Cognito `sub` directly (a documented refinement over the Phase 2 schema doc's literal wording — see the flagged decision below).
- `createService()` (`src/modules/services/services.service.ts`) is the **one** function both `POST /provider/listings` and `POST /admin/services` call. Every listing — regardless of who created it — starts `pending_approval`. There is no code path that publishes a listing directly.
- `GET /admin/listings/pending`, `POST /admin/listings/:id/approve`, `POST /admin/listings/:id/reject` (`src/modules/approvals/approvals.routes.ts`) are the **one** shared queue. `createdByRole` filters within it, but there is no second, separate approval system for Admin-created listings — confirmed by `approval.test.ts`'s "shows both Provider- and Admin-created listings in the ONE shared queue" test.
- Approve/reject record `approved_by_user_id` (the approving Admin's `sub`), `approved_at`, and (for reject) `rejection_reason`.
- Every customer-facing catalog query applies `publicVisibilityFilter()` — `approval_status = 'approved' AND active = true` — at the SQL level (plus a city-availability join when a `cityId` is given). This is never bypassable from the frontend because the frontend never gets to specify the filter; the backend applies it unconditionally.

**Flagged decision — editing an approved listing** (Phase 2 Open Question #27, left `TBD`): a Provider editing their own `approved` listing forces it back to `pending_approval` (a Provider can never publish a change directly); an Admin editing any listing never forces a requeue (Admin already holds unilateral approve/reject authority, so gating their own edit behind their own approval click is pure friction with no security benefit); editing a `rejected` listing (either role) returns it to `pending_approval`, giving the Provider a path back in. This needs client confirmation — it is not assumed correct by default, only necessary to ship something coherent.

**Flagged decision — `created_by_user_id` storage**: stores the Cognito `sub` directly rather than an internal `service_providers.id`/`customers.id`, so `requireOwnership()` checks are a direct string comparison with no extra join. Transparent, minor refinement over the Phase 2 doc's literal column description.

---

## 8. Pricing implementation

`src/shared/pricing.ts`'s `computeDiscount(mrp, offerPrice)` is a direct, line-for-line port of the existing frontend's `src/lib/pricing.ts` — same rounding, same zero-result guard, never reinterpreted. Discount is always derived at read time from `services.mrp`/`services.offer_price`; it is never stored.

Every price a customer is ever charged is re-read from `services` at the moment it matters — added to cart (`unit_price_at_add` is a display snapshot only, not authoritative), and **authoritatively** at order creation (`orders.service.ts`'s `createOrder()` re-fetches `services.mrp`/`services.offer_price` for every cart line, never trusting the cart's cached price or anything the client's request body contains). `orders.test.ts`'s "re-fetches the live price at order time" and "never lets a client-submitted price/total influence the created order" tests exercise this directly — sending `{ total: 1, subtotal: 1, discountTotal: 999 }` in the request body has zero effect on the created order.

### PHASE 3 CORRECTION — Offer applicability, priority, and combined pricing

Open Question #25 ("does an Offer's discount combine with a service's own discount?") is now **resolved**: it does. This section supersedes the original "never combined" statement above and in `PHASE_2_BACKEND_DATABASE_SCHEMA.md`/`PHASE_2_BACKEND_API_CONTRACT.md`/`PHASE_2_BACKEND_OPEN_QUESTIONS.md` (those documents have been updated to match — see their own correction notes).

**Offer applicability** (`offers.applicability_type`, migration 000012): every Offer is either

- **`all_india`** — applies nationwide, `city_id` is always `NULL`, or
- **`city`** — applies to exactly one named city, `city_id` is always set.

The two are mutually exclusive and enforced by a database `CHECK` constraint (`chk_offers_applicability_city`), not just application code — an invalid combination can never be persisted even by a bug elsewhere in the codebase. `offers.service.ts`'s `createOffer()`/`updateOffer()` validate the same rule up front (for a friendlier `400` instead of a raw DB error) and additionally validate: `cityId` references a real city; a percent `discountValue` is between 0 and 100; `startDate <= endDate`; and every id in `appliesTo.ids` references a real service/category.

**Resolving the one effective Offer** (`offers.service.ts`): `getActiveOffersForCity(cityId)` fetches the full candidate pool for a city in exactly two queries (one for `all_india` offers, one for `city` offers matching that city), both already filtered to `active = true` and within `start_date`/`end_date`. `pickEffectiveOffer(pool, {serviceId, categoryId})` then applies the **FINAL OFFER PRIORITY RULE**: a matching `city` offer always wins over a matching `all_india` offer — the two are **never stacked**. `resolveEffectiveOffer(cityId, serviceId, categoryId)` is the convenience wrapper for a single lookup (a cart item, an order line, one service's detail page); the catalog-list path (`listServicesPublic`) instead fetches the pool **once per page** and reuses it for every item, so pricing an N-item catalog page never costs more than two offer queries regardless of N.

**Flagged decision — tie-break for an ambiguous admin configuration**: if more than one Offer matches the same tier (e.g. two `city` offers both scoped to Ranchi with overlapping dates), the brief requires this never silently stack; this implementation resolves it deterministically by picking the most-recently-created match. This is tracked by a plain auto-increment `seq` column (migration 000012) rather than `created_at` — two Offers created inside the same second would otherwise tie, since `created_at` is only second-precision, and `seq` can never tie. This is flagged for client confirmation like any other brief-left-open resolution rule, not silently assumed to be the only correct one.

**Combining the two discounts** (`shared/pricing.ts`'s `computeFinalPricing(mrp, offerPrice, offer)`) — the ONE place this combination happens, shared by catalog/service-detail, cart display, and order creation so the math can never drift between them:

```
mrp → offerPrice (service's own discount, display-only)
    → offer discount, applied to offerPrice (never to mrp)
    → finalPrice = offerPrice − offerDiscountAmount, floored at 0
totalDiscountAmount = serviceDiscountAmount + offerDiscountAmount
```

A percentage offer is computed against the service's **offer price**, never the raw `mrp` (confirmed by a dedicated test). A discount larger than the base it's applied to simply consumes the whole base — `offerDiscountAmount` is capped so `finalPrice` can never go negative, and the capped amount is what's reported, so `totalDiscountAmount` always reconciles exactly with `mrp - finalPrice`.

**Where this is exposed:** `PublicServiceDto` (catalog listing, service detail) gains `effectiveOffer`, `offerDiscountAmount`, `totalDiscountAmount`, `finalPrice` alongside the existing, unchanged `mrp`/`offerPrice`/`discountPercent`/`discountAmount` fields — resolved only when the request supplies a `cityId` (without one there is no city context to pick a `city` offer over an `all_india` one, so the response falls back to `effectiveOffer: null`, `finalPrice === offerPrice` rather than guessing). `GET /offers` now actually filters by `cityId` (`all_india` ∪ that city's `city` offers — never another city's) where the original implementation accepted the parameter but ignored it (§17 of the original implementation flagged this as a known limitation; it is now resolved). `GET /admin/offers` and `GET /admin/offers/:id` (new, §6) give Admin an unrestricted, every-city view for management, since the public endpoint deliberately hides other cities' `city` offers.

---

## 9. Cart implementation

Design A (hybrid), finalized by the Phase 3 brief: anonymous browsing stays entirely client-local (the existing frontend's `localStorage`-based `CartProvider`, untouched) — the `carts`/`cart_items` tables exist **only** for an authenticated customer (`carts.customer_id NOT NULL`).

- `GET/POST/PATCH/DELETE /customer/cart*` (`src/modules/cart/`) — add (additive quantity on a repeat `service_id`+`city_id`), set-quantity, remove, and read, each just-in-time creating the customer's cart row on first use.
- Every read re-derives, per item: whether the service still exists, is still `approved`+`active`, and is still offered in that item's city (`isServicePurchasableInCity()`, shared with the services and orders modules) — a `false` result flags the item `isAvailable: false` and excludes it from `subtotal`, without silently deleting it, so the customer can see and resolve what changed.
- `priceChanged` compares the cart's stored `unit_price_at_add` against the service's current `offer_price` — display-only; it never affects what an order actually charges (§8).
- `POST /customer/cart/merge` — the login-time merge step: given the frontend's local (anonymous) cart items, sums quantities into matching (service, city) pairs already on the server cart and reports which submitted items were skipped (removed/unavailable) rather than failing the whole merge.
- **PHASE 3 CORRECTION**: each cart item's response now also resolves and displays the combined service-discount + effective-offer price for that item's own `city_id` (`mrp`, `serviceDiscountAmount`, `effectiveOffer`, `offerDiscountAmount`, `totalDiscountAmount`, `finalUnitPrice`), via the same `resolveEffectiveOffer`/`computeFinalPricing` functions §8 describes — and `lineTotal`/`subtotal` are now based on this offer-inclusive price. This remains **display-only**: order creation never reads any of it, it re-resolves everything itself from the database (§10). A cart can structurally hold items added in different cities (Open Question #16), so each item resolves its own offer independently, never a single cart-wide offer.

---

## 10. Order implementation

`POST /customer/orders` (`src/modules/orders/orders.service.ts`'s `createOrder()`) is, by design, the most defensive write in the codebase:

1. **Cannot be reached unauthenticated** — `authenticate()` + `requireRole("customer")`, and structurally backed by `orders.customer_id NOT NULL`; there is no code path that can insert an order without a customer id.
2. Idempotency: a repeated request with the same `idempotencyKey` returns the already-created order rather than creating a duplicate (`orders.idempotency_key` is globally unique) — verified in `orders.test.ts`.
3. Validates the address belongs to the calling customer (`getOwnAddressById`) — 404 otherwise.
4. Loads the customer's cart; an empty cart is a `409 Conflict`, not a zero-item order.
5. Re-validates and re-prices **every** cart line against `services` directly (§8) — never the cart's cached price, never anything in the request body. **PHASE 3 CORRECTION**: for each line, also re-resolves the ONE effective Offer (`resolveEffectiveOffer`, §8) for that line's own `city_id` and combines it with the service's own discount via `computeFinalPricing` — the identical shared function the catalog/cart display uses, so order-time math can never drift from what the customer was shown.
6. Computes `subtotal` (Σ mrp×qty), `discount_total` (Σ (serviceDiscount+offerDiscount)×qty — combined per §8's correction), `total` (Σ finalUnitPrice×qty) server-side.
7. Snapshots the chosen address's fields onto the `orders` row (`address_label`/`line1`/`line2`/`city`/`state`/`pincode`) and, **per the correction**, the FULL pricing breakdown onto each `order_items` row: `mrp_snapshot`, `service_offer_price_snapshot`, `service_discount_amount`, `effective_offer_id`/`effective_offer_name_snapshot`/`effective_offer_applicability_type_snapshot`, `offer_discount_amount`, `total_discount_amount`, plus the existing `service_name_snapshot`/`unit_price` (now the final, offer-inclusive price)/`line_total` — so a later Admin price edit, Offer edit/deletion, or a customer editing/deleting that saved address can never rewrite a historical order. The Offer link uses `ON DELETE SET NULL`, but the name/applicability snapshot columns survive the Offer's deletion regardless, so a historical order's display is never affected by it (confirmed by a dedicated test that changes both the service's price and the Offer's discount value after an order is placed, then re-reads the order unchanged).
8. Runs the insert + line items + cart-clear inside one Knex transaction.
9. Generates a human-readable `order_number` (`ORD-YYYYMMDD-XXXXXXXX`).

`GET /customer/orders`, `GET /customer/orders/:id` (ownership-checked — a resource that exists but belongs to someone else is `403`, not `404`; only a genuinely nonexistent order is `404`) and `GET/PATCH /admin/orders*` (operational listing + status/provider-assignment update) round out the module. Payment stays abstract (§17) — `orders.payment_status` starts `"not_applicable"` and no code path ever marks a payment `succeeded` without a real gateway integration to justify it.

---

## 11. S3 / media implementation

Backend-brokered pre-signed upload flow exactly as `PHASE_2_AWS_ARCHITECTURE.md` §15 specifies — the browser never receives an AWS credential, only a short-lived (`S3_UPLOAD_URL_TTL_SECONDS`, default 300s), single-object pre-signed `PUT` URL:

1. `POST /media/upload-url` — validates `contentType` against an allow-list (`image/jpeg`, `image/png`, `image/webp`, `video/mp4`) and `fileSizeBytes` against `S3_MAX_UPLOAD_BYTES` **before** touching S3; validates the caller may manage media on the target service (Admin always; Provider only their own, and only while `pending_approval`/`rejected` — the contract's own restriction, enforced in `assertCanManageServiceMedia()`); generates a key under a service-specific prefix (`services/<serviceId>/<uuid>-<sanitized filename>`) — a separate logical prefix per entity type, never shared with any other kind of upload.
2. Browser uploads directly to S3 with that URL — large media never transits the backend.
3. `POST /media/:serviceId/images` — records the resulting key (turned into a public object URL) as a `service_images` row, after the same ownership/approval-status check.
4. `DELETE /media/images/:id` — deletes the MySQL row (the source of truth for "attached to this listing") and best-effort deletes the underlying S3 object too, never blocking the request on that second step succeeding.

**No S3 bucket policy, prefix structure, or CloudFront distribution was created or modified** — this phase is backend code only (§17/§18).

**Flagged decision — MIME/size limits**: the approved AWS doc only gives an illustrative "a few MB for images, larger for video" without fixing real numbers, so a single shared `S3_MAX_UPLOAD_BYTES` cap is used rather than inventing differentiated per-type limits.

**Flagged, documented limitation**: presigned-URL generation is genuinely tested (it's pure local SigV4 signing, no network call — see §15), but no real S3 bucket exists in this sandbox, so no actual object upload was ever exercised end-to-end.

---

## 12. Admin content architecture

`src/modules/content/` — six small entities plus the legacy read-only `plans` list, covering the brief's full Admin Panel "Content" and "Branding" scope: `testimonials` (approval-gated — only `approved: true` rows are public), `faqs`, `homepage_sections` (keyed by a stable, admin-chosen `key` like `"hero"`, not a UUID, since the frontend template looks sections up by that key), `contact_info` (singleton row, `id = "singleton"`), `branding` (singleton — `logoUrl`/`logoAlt`/`brandAssets`, referencing S3 URLs from the media flow, never binary uploads through this module), `nav_items`.

Every one of these is DB/API-backed with no hardcoded homepage/FAQ/contact/nav text anywhere in the backend. **The existing frontend was not redesigned or touched** — these endpoints exist for the frontend's `src/lib/data/*` Data Access Layer to call *instead of* its current mock data, whenever that integration work happens (explicitly out of scope for this phase — §18).

**Resolved** (previously a flagged decision): `PHASE_2_BACKEND_API_CONTRACT.md` originally marked this whole area "only built if Admin content-management scope is confirmed." The Phase 3 brief named it directly and explicitly ("Content: homepage content/sections/headings/descriptions/FAQs/About/contact info/promotional banners/... Branding: logo/brand assets"), and the subsequent documentation-reconciliation pass carries the client's final, explicit confirmation of broad Admin content-management scope — see `PHASE_2_BACKEND_OPEN_QUESTIONS.md` item 20.

---

## 13. Security implementation

- **JWT validation**: real signature/issuer/audience/expiry checks via `aws-jwt-verify`, never bypassed (§4, §15).
- **Role authorization**: `requireRole()` on every private route; role always comes from the verified token, never the client (§5).
- **Ownership checks**: `requireOwnership()` / `assertCanManageServiceMedia()` wherever a resource has a single rightful owner (§5).
- **Input validation**: every request body/query/params object is `zod`-parsed before a handler runs (`src/middleware/validate.ts`); a validation failure is a uniform `400 VALIDATION_ERROR`.
- **SQL injection protection**: 100% Knex query-builder calls (parameterized under the hood) — zero raw string-interpolated SQL anywhere in the codebase; the handful of `knex.raw(...)` calls (`JSON_CONTAINS` for offer scoping, `CHECK` constraints in migrations) all use `?` placeholders, never string concatenation of request input.
- **CORS**: explicit origin allow-list (`CORS_ALLOWED_ORIGINS`), never a wildcard; same-origin/server-to-server requests (no `Origin` header) are allowed, any other origin must be on the list.
- **Rate limiting**: `express-rate-limit`, applied globally (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX_REQUESTS`).
- **Secure headers**: `helmet()`, applied globally; `x-powered-by` disabled.
- **S3 upload validation**: content-type allow-list + size cap enforced *before* a pre-signed URL is ever issued (§11).
- **Secret management**: no secret is ever hardcoded; local development reads an untracked `.env` (see §14); production is documented to use the Phase 2-approved Secrets Manager/SSM approach, never committed values.
- **Request IDs**: every request gets a `crypto.randomUUID()` request ID (`src/middleware/requestId.ts`), echoed in every response and log line for traceability.
- **Structured logs**: `pino`, JSON, technical detail (stack traces, raw SQL errors) logged server-side only — **never** returned in an API response, which always gets the uniform `{ code, message }` shape (`src/middleware/errorHandler.ts`); a raw `AppError` message is safe-by-construction (hand-written, no interpolated internals), anything else becomes a generic `"An unexpected error occurred."` in the response while the real error is logged in full.
- **Never committed**: verified `git status`-equivalent by inspection — no `.env`, no AWS keys, no DB password, no Cognito secret anywhere in a tracked file; `.gitignore` covers `.env*`, `node_modules/`, `dist/`, `coverage/`.

No destructive action was taken against any AWS resource or the real RDS instance at any point in this phase (§16).

---

## 14. Environment variables

Every variable is declared once, centrally, and zod-validated (`src/config/env.ts`) — a missing *required* variable fails fast at boot rather than reaching a query or SDK client as `undefined`. Full list with placeholder values only in `.env.example`; real values live only in the untracked, gitignored local `.env` (never synced to the device, never committed).

| Group | Variables |
|---|---|
| Server | `NODE_ENV`, `PORT`, `API_BASE_PATH`, `LOG_LEVEL` |
| CORS | `CORS_ALLOWED_ORIGINS` |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_TEST_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_CONNECTION_LIMIT` |
| Cognito | `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CUSTOMER_APP_CLIENT_ID`, `COGNITO_ADMIN_PROVIDER_APP_CLIENT_ID`, `COGNITO_ADMIN_PROVIDER_APP_CLIENT_SECRET` |
| S3 | `S3_BUCKET_NAME`, `S3_REGION`, `S3_UPLOAD_URL_TTL_SECONDS`, `S3_MAX_UPLOAD_BYTES` |
| AWS (local-dev-only fallback) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — **never set in production**; ECS Fargate's task IAM role supplies credentials there via the SDK's default provider chain |
| Payment gateway | commented out entirely — `TBD / CLIENT CONFIRMATION REQUIRED`, no provider selected (§17) |
| Rate limiting | `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` |

---

## 15. Testing

**90 tests, 11 suites, all passing** (`npm test` → `Test Suites: 11 passed, 11 total` / `Tests: 90 passed, 90 total`), run against a disposable local MySQL database (`handyman_test`) — never the real RDS instance. (62 tests/10 suites from the original implementation, plus 28 tests in a new `offer-pricing.test.ts` suite added by the Offer/pricing correction — see `PHASE_3_BACKEND_TEST_REPORT.md` for the itemized breakdown.)

| Suite | Focus |
|---|---|
| `auth.test.ts` (8) | missing/malformed header, wrong signature, expired token, wrong issuer, wrong `client_id`, unrecognized role group, genuine success path |
| `authorization.test.ts` (7) | role gates (customer/provider blocked from admin routes), ownership checks (cross-provider listing edit, cross-customer address access), spoofed-role-header has no effect, 404-vs-403 distinction |
| `approval.test.ts` (7) | Provider- and Admin-created listings both start `pending_approval`, both hidden publicly, both in the one shared queue; Provider blocked from the queue; approve/reject; re-edit-after-approval requeue rule |
| `catalog.test.ts` (5) | public visibility filter (pending/rejected excluded), discount computation matches the shared helper, city-availability filtering, 404 on unknown slug |
| `cart.test.ts` (6) | unauthenticated rejection, city-unavailable rejection, additive quantity, update/remove, stale-item flagging after deactivation, merge with skipped-item reporting |
| `orders.test.ts` (8) | unauthenticated rejection, empty-cart rejection, correct server-computed totals + address snapshot + cart-clear, live-price-at-order-time (not the cart's cached price), client-submitted-price has zero effect, idempotency-key dedup, cross-customer 403, Admin list/status-update |
| `offers-search.test.ts` (4) | active-only offers, admin-only write, search across categories/products/approved-services, unapproved service excluded from search |
| `media.test.ts` (8) | content-type/size rejection, genuine pre-signed URL issuance (§11), cross-provider rejection, approved-listing rejection for Providers, Admin bypass, attach + delete, role gate |
| `content.test.ts` (4) | approved-only public testimonials vs. full admin view, write-role gate, homepage-section CRUD by key, singleton contact-info/branding upsert |
| `users.test.ts` (4) | role-shaped `/me` for each of the three roles, unauthenticated rejection |

**Genuine, not mocked, JWT verification** (`tests/helpers/cognitoTestKit.ts`): a locally-generated RSA keypair's public half is injected into the *real* `aws-jwt-verify` verifier via its documented `.cacheJwks()` API (confirmed to exist by reading `node_modules/aws-jwt-verify/jwt-rsa.d.ts` before relying on it, not assumed) — tokens are hand-signed RS256 with the matching private key, so a bad signature, wrong issuer, wrong audience, or expired token is rejected by the actual verification code path, never a stub.

**Genuine, not mocked, S3 presigning** (`media.test.ts`): `getSignedUrl()` is pure local SigV4 computation — no network call to AWS — so it runs for real against fake local credentials (`tests/.env`'s `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`S3_BUCKET_NAME`, all clearly-fake local-only values, never real AWS credentials). What is **not** exercised: an actual object upload/delete against a real bucket — there is no real bucket in this sandbox (§11, §17).

What automated tests do **not** cover, and why: the actual RDS `database-1` connection (never attempted — §16), a real Cognito admin-disable API call (§17), a real payment gateway (none selected — §17), and full AWS infrastructure (not provisioned in this phase — §18). See `PHASE_3_BACKEND_TEST_REPORT.md` for the itemized pass/fail report.

---

## 16. Migration strategy and database safety

**No connection to the real RDS `database-1` instance was ever attempted, configured, or credentialed in this phase.** Both `development` and `test` Knex profiles (`src/database/knexfile.ts`) point only at a local, disposable MySQL 8 server installed inside this sandbox for the sole purpose of validating the migration set (`apt-get install mysql-server`; two databases, `handyman_dev` and `handyman_test`, with a dedicated local-only user/password that exists nowhere outside this sandbox).

Validation performed: `migrate:latest` (11 migrations applied) → `migrate:rollback --all` (clean full rollback) → `migrate:latest` again (clean, idempotent re-apply, proving every migration's `up`/`down` pair is genuinely reversible) → `migrate:status` (all 11 listed completed, none pending) — repeated against both `handyman_dev` and `handyman_test`.

Since no connection to the real RDS instance was made, its actual current data state is unknown to this implementation. Per the brief's explicit instruction, that uncertainty is being reported rather than resolved by assumption: **before any migration is applied to the real RDS instance, someone with real RDS access must first confirm whether it currently holds any data** (the brief allows documenting "RDS is empty" as sufficient grounds to proceed if that is in fact the case, but this implementation has no way to verify that itself). Until that confirmation happens, no migration should be run against RDS, no destructive operation should be considered, and a snapshot/backup should be taken immediately beforehand regardless of the answer, per the approved deployment procedure.

---

## 17. Remaining limitations / TBDs

Carried over from Phase 2 (still genuinely unresolved, not silently decided here):

- ~~Open Question #25 — whether an `Offer`'s discount ever combines with a service's own `mrp`/`offerPrice` discount.~~ **Resolved by the Offer/pricing correction (§8): it does combine.** See `PHASE_2_BACKEND_OPEN_QUESTIONS.md`'s own correction note.
- **Payment gateway** — no provider selected. `payments` table and `orders.payment_status` exist as a gateway-agnostic boundary only; no `/payments/*` route, no webhook handler was built (see `src/modules/payments/NOT_IMPLEMENTED.md`).
- **Cognito admin-disable** — `PATCH /admin/customers/:id` / `PATCH /admin/providers/:id` update the local `account_status` column and correctly block further access via `findOrCreate...BySub()`'s disabled-account check, but do **not** call the Cognito Admin API to disable the underlying Cognito user, since no real Cognito credentials are available in this sandbox to test that call against. Flagged as an explicit gap, not silently skipped.

New, implementation-level decisions this phase had to make explicit (each documented in-line above, repeated here for visibility):

- The approved-listing edit/requeue policy (§7).
- `created_by_user_id` storing the Cognito `sub` directly (§7).
- A single shared `S3_MAX_UPLOAD_BYTES` cap rather than per-media-type limits (§11).
- Admin content-management scope being genuinely in-scope for Phase 3 (§12), resolving Phase 2's "only if confirmed" conditional.
- ~~`GET /offers`'s `cityId` query parameter is accepted but not yet a real filter.~~ **Resolved by the Offer/pricing correction (§8): `cityId` now genuinely filters to `all_india` ∪ that city's `city` offers.** `serviceId`/`categoryId` filtering (via each offer's `applies_to_scope`/`applies_to_ids`) remains fully implemented, unchanged.
- `GET /search` mirrors the existing frontend's client-side `searchCatalog()` signature and matching rule (case-insensitive substring on `name`) exactly, now backed by the real DB and the same approved+active visibility rule as every other catalog query.
- **(Correction)** The deterministic tie-break when more than one Offer matches the same tier for the same service/city — most-recently-created wins, tracked by a dedicated `seq` column (§8).
- **(Correction)** Adding `GET /admin/offers` and `GET /admin/offers/:id` — not in the original 79-endpoint list, added because the correction brief explicitly names Admin "READ" as a required capability that the public, city-scoped `GET /offers` cannot serve (§6).

Explicitly not built in this phase (all deliberate, per the brief's own phase-separation instruction — see §18):

- Any AWS infrastructure (ECS Fargate, ALB, target group, security groups, S3 bucket policy/prefix changes, CloudFront) — code only, this phase.
- Frontend integration — `src/lib/data/*`'s mock implementations were not touched or replaced; no frontend file was modified.
- A seed dataset (`src/database/seeds/` is empty) — the two local databases used for migration validation were never seeded with sample rows; every automated test creates its own minimal fixtures via `tests/helpers/factories.ts` instead.
- Phase 4 QA of any kind.

---

## 18. Deployment readiness

| Item | Status |
|---|---|
| Backend code | Complete for the scope above; typecheck/lint/build/tests all clean (see the test report) |
| Database schema | Fully migrated and validated against a disposable local MySQL instance; **not yet applied to RDS** — blocked on the data-safety confirmation in §16 |
| Cognito | Not modified; backend is written to validate against the existing pool/app clients once `COGNITO_USER_POOL_ID`/`COGNITO_CUSTOMER_APP_CLIENT_ID`/`COGNITO_ADMIN_PROVIDER_APP_CLIENT_ID` are set in the real environment |
| S3 | Not modified; backend is written to presign against the existing bucket once `S3_BUCKET_NAME` is set in the real environment |
| AWS infrastructure (ECS Fargate + ALB) | **Not provisioned** — explicitly separated from code implementation per the brief's (A) code / (B) infrastructure / (C) deployment / (D) frontend-integration split. A future infrastructure-provisioning pass would need: an ECR repository, a task definition referencing this backend's container image, a service behind the existing/a new ALB target group, the task's IAM role granted exactly the S3 (presign + object CRUD under the service-media prefix) and Cognito (none needed — verification is JWKS-based, no AWS API call) permissions it needs, and the real Cognito/S3/DB environment variables supplied via Secrets Manager/SSM, never hardcoded |
| Frontend integration | Not started — `src/lib/data/*` remains on mock data |
| Payment gateway | Not selected, not integrated |

Per the brief's explicit stop condition, this phase ends here. **No production deployment, no AWS infrastructure creation, no frontend integration, no Phase 4 QA, no payment gateway integration, and no DNS cutover will happen without explicit instruction to proceed.**

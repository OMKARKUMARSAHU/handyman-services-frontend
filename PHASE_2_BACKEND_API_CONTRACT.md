# Phase 2 — Backend API Contract
## Handyman Services Marketplace

**Status:** Design only at the time this document was written. This was the proposed REST contract for Phase 3 to build against, versioned under `/api/v1`. **Phase 3 has since implemented the large majority of this contract** (see `PHASE_3_BACKEND_IMPLEMENTATION.md`); the per-endpoint notes below have been updated in place to reflect final client decisions, but this document's original "proposed design" framing is otherwise left intact for historical traceability.

**Builds on:** `PHASE_2_API_CONTRACT.md` (the existing frontend-facing mock Data Access Layer contract — this document is that same contract's real-network realization, per `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §25's migration map), `PHASE_2_BACKEND_DATABASE_SCHEMA.md` (the tables every endpoint reads/writes), `PHASE_2_AUTHORIZATION_MATRIX.md` (the role/ownership rules referenced by "Auth" below).

**Conventions used throughout:**
- Base path: `/api/v1`.
- Every response uses the envelope defined in `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §18 (`{success, data}` or `{success, error}`).
- **Auth** column: `Public` (no token required), `Any authenticated` (any valid role), or the specific role(s) required, plus `+ownership` where the caller must own the resource (§17/Authorization Matrix doc).
- **Pagination**: all list endpoints accept `?page=<n>&pageSize=<n>` (default `page=1`, `pageSize=20`, max `pageSize=100`) and return `meta: { page, pageSize, total, totalPages }`.
- **Filtering/sorting**: each list endpoint documents its own supported `?filter` query params below; sorting, where offered, uses `?sort=<field>&order=asc|desc`.
- **Validation**: every write endpoint validates its body against a schema before touching the database (§19, System Architecture doc); a validation failure returns `400 VALIDATION_ERROR` with per-field `details`.
- **Errors**: standard categories per §18 of the System Architecture doc (`400/401/403/404/409/429/500`) apply to every endpoint below and are not re-listed per-row except where an endpoint has a distinctive failure mode worth calling out.
- None of these endpoints are implemented in this phase.

---

## PUBLIC endpoints (no authentication)

| Method | Endpoint | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/cities` | Query: `?popular=true` (optional filter) | `City[]` | |
| GET | `/cities/:slug` | — | `City \| 404` | |
| GET | `/categories` | — | `Category[]` (active only) | |
| GET | `/categories/:slug` | — | `Category \| 404` | |
| GET | `/categories/:categorySlug/products` | — | `Product[]` (active, sorted) | |
| GET | `/categories/:categorySlug/products/:productSlug` | — | `Product \| 404` | |
| GET | `/service-types` | — | `ServiceType[]` (active) | |
| GET | `/services` | Query: `productId`, `categoryId`, `cityId`, `serviceTypeId`, `featured=true`, `mostBooked=true` (combine as needed) | `Service[]` (approved + active only, §9/§11 of Database doc), each with derived `discountPercent`/`discountAmount` (§10) | Pagination + sort (`sort=sortOrder\|name\|offerPrice`) |
| GET | `/services/:slug` | Query: `?cityId=` (optional — 404 if the service isn't available in that city) | `Service \| 404` | Includes `images: ServiceImage[]` |
| GET | `/offers` | Query: `cityId`, `serviceId`, `categoryId` | `Offer[]` (active only) | **PHASE 3 CORRECTION:** `cityId` now genuinely filters — returns `ALL_INDIA` offers ∪ that city's `CITY` offers, never another city's `CITY` offer; combines with a service's own discount at the service/cart/order level (§10, resolved) |
| GET | `/search` | Query: `q` (required), `cityId` (optional) | `{ categories: Category[], products: Product[], services: Service[] }` | Mirrors the existing mock's substring-match scope; ranking/typo-tolerance is a future enhancement, not designed here |
| GET | `/faqs` | — | `FAQ[]` | **RESOLVED** — Admin content-management scope is confirmed; built in Phase 3 |
| GET | `/testimonials` | — | `Testimonial[]` (approved only) | Same — confirmed and built |
| GET | `/homepage-sections` | — | `HomepageSection[]` | Same — confirmed and built |
| GET | `/contact-info` | — | `ContactInfo` | Same — confirmed and built |
| GET | `/plans` | — | `Plan[]` | Legacy, unlinked from primary navigation per existing decision — endpoint retained only if the frontend's `/plans` route stays live |

---

## CUSTOMER endpoints

| Method | Endpoint | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/me` | Any authenticated | — | Role-aware profile — for a Customer: `Customer` shape (name, phone, email); for Admin/Provider, their respective shape | Replaces the reserved mock `getCurrentCustomer()` |
| PATCH | `/me` | Customer | `{ name?, phone?, email? }` | Updated `Customer` | Sign-in method is resolved as email+password (§4, Authorization Matrix doc); an email change may require Cognito's own re-verification step — not designed to the byte level here |
| GET | `/addresses` | Customer +ownership | — | `Address[]` (own only) | |
| POST | `/addresses` | Customer +ownership | `{ label, line1, line2?, city, state, pincode, isDefault? }` | `Address` | |
| PATCH | `/addresses/:id` | Customer +ownership | Partial `Address` | `Address` | 403/404 if not the caller's own address |
| DELETE | `/addresses/:id` | Customer +ownership | — | `{ success: true }` | |
| GET | `/cart` | Customer | — | `Cart` (with derived `subtotal`, `itemCount`) | **RESOLVED** — Design A (hybrid) is final (§12, Database doc): this endpoint serves the authenticated, server-persisted cart only; the anonymous guest cart has no backend endpoint and stays in `localStorage` |
| POST | `/cart/items` | Customer | `{ serviceId, cityId, quantity? }` | `Cart` | |
| PATCH | `/cart/items/:id` | Customer +ownership | `{ quantity }` | `Cart` | `quantity <= 0` removes the item, matching existing behavior |
| DELETE | `/cart/items/:id` | Customer +ownership | — | `Cart` | |
| DELETE | `/cart` | Customer +ownership | — | `{ success: true }` | Clear cart |
| POST | `/orders` | Customer | `{ items: [{serviceId, quantity}], address: {...}, scheduledDate, scheduledSlot?, idempotencyKey }` | `Order` | **RESOLVED** — guest checkout is disallowed, so this is Customer-only, never public. Validates non-empty cart, complete address, a scheduled date (mirrors the existing mock's own validation exactly); idempotent on `idempotencyKey` (§14/§19 of the other docs); the server recalculates all pricing from the database rather than trusting cart/client values |
| GET | `/orders/:id` | Customer +ownership | — | `Order \| 404` | **RESOLVED** — guest checkout is disallowed, so this endpoint is Customer +ownership only, never public |
| GET | `/orders` | Customer +ownership | Query: `status` (optional filter) | `Order[]` (own only) | Pagination |

---

## ADMIN endpoints (role: `admin`)

| Method | Endpoint | Request | Response | Notes |
|---|---|---|---|---|
| POST / PATCH | `/admin/cities`, `/admin/cities/:id` | `City` fields | `City` | |
| POST / PATCH | `/admin/categories`, `/admin/categories/:id` | `Category` fields | `Category` | |
| POST / PATCH | `/admin/products`, `/admin/products/:id` | `Product` fields | `Product` | |
| POST / PATCH | `/admin/service-types`, `/admin/service-types/:id` | `ServiceType` fields | `ServiceType` | |
| POST / PATCH | `/admin/services`, `/admin/services/:id` | `Service` fields (`mrp`, `offerPrice`, etc.) | `Service` | **RESOLVED — the prior "approved immediately" assumption was INCORRECT.** An Admin-created service is created `pending_approval`, exactly like a Provider-created one, and goes through the same shared approval queue (Admin self-approval from that queue is permitted by design — §9, Database doc); an Admin edit to an existing, already-approved service does not reset its `approval_status` |
| PUT | `/admin/services/:id/city-availability` | `{ cityId, active }[]` | `ServiceCityAvailability[]` | Bulk-set which cities a service is available in |
| POST / PATCH | `/admin/offers`, `/admin/offers/:id` | `Offer` fields (now including `applicabilityType`: `all_india`\|`city`, and `cityId`, required together per PHASE 3 CORRECTION §10) | `Offer` | |
| GET | `/admin/offers`, `/admin/offers/:id` | Query (list): `applicabilityType`, `cityId`, `active`, pagination | `Offer[]` / `Offer` | **Added by PHASE 3 CORRECTION** — unrestricted, every-city Admin read, since the public `GET /offers` deliberately hides other cities' `CITY` offers |
| GET | `/admin/listings/pending` | Query: pagination | `Service[]` (where `approval_status = 'pending_approval'`) | The approval queue |
| POST | `/admin/listings/:id/approve` | — | `Service` (now `approved`) | Sets `approved_by_user_id`, `approved_at` |
| POST | `/admin/listings/:id/reject` | `{ reason }` (required) | `Service` (now `rejected`) | Sets `rejection_reason` |
| GET | `/admin/orders` | Query: `status`, `cityId`, pagination | `Order[]` (all) | |
| PATCH | `/admin/orders/:id` | `{ status?, providerId? }` | `Order` | Manual status/assignment update — the automated-assignment question (Open Question #7) is out of scope; this is the manual fallback either way |
| GET | `/admin/customers` | Query: pagination, `search` | `Customer[]` | |
| PATCH | `/admin/customers/:id` | `{ accountStatus }` | `Customer` | Mirrors a Cognito-side enable/disable action — the backend call should itself trigger the corresponding Cognito admin action, not just flip the local mirror column (§4, Authorization Matrix doc) |
| GET | `/admin/providers` | Query: pagination, `search` | `ServiceProvider[]` | |
| PATCH | `/admin/providers/:id` | `{ accountStatus }` | `ServiceProvider` | Same Cognito-sync note |
| POST / PATCH / DELETE | `/admin/faqs`, `/admin/testimonials`, `/admin/homepage-sections`, `/admin/contact-info` | Entity-specific fields | Entity | **RESOLVED** — Admin content-management scope is confirmed (covers content/branding broadly, not just these four entities); built in Phase 3 |

---

## PROVIDER endpoints (role: `provider`)

| Method | Endpoint | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/provider/me` | Provider | — | `ServiceProvider` profile | |
| PATCH | `/provider/me` | Provider | `{ name?, phone? }` | `ServiceProvider` | |
| GET | `/provider/listings` | Provider +ownership | Query: `status` (filters by `approval_status`), pagination | `Service[]` (own listings only — `created_by_user_id = caller`) | |
| POST | `/provider/listings` | Provider | `Service` fields (minus admin-only fields like `isMostBooked`) | `Service` (created as `pending_approval`) | Never publishes immediately — §9 |
| PATCH | `/provider/listings/:id` | Provider +ownership | Partial `Service` fields | `Service` | Editing a `rejected` listing transitions it back to `pending_approval` (§9). Editing an `approved` listing: Phase 3 implements re-queue-to-`pending_approval` as its working behavior (a Provider can never publish an edit directly) — **this remains flagged as awaiting explicit client policy confirmation** (`PHASE_2_BACKEND_OPEN_QUESTIONS.md` item 27), not yet a final sign-off, though it is the behavior currently running |
| GET | `/provider/listings/:id` | Provider +ownership | — | `Service \| 404` | Includes `rejectionReason` if rejected |
| GET | `/provider/orders` | Provider +ownership | Query: pagination | `Order[]` (where `provider_id` = caller) | **Only built if "assigned orders" is confirmed in the Provider's scope** — Phase 1 flagged this as a future view tied to the existing `assignedOrderIds` field; not a firm commitment |

---

## MEDIA endpoints

| Method | Endpoint | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/media/upload-url` | Admin, or Provider +ownership (for their own pending/rejected listing only) | `{ serviceId, fileName, contentType, fileSizeBytes }` | `{ uploadUrl, key, expiresAt }` | Backend validates `contentType` against the allowed image/video MIME list and `fileSizeBytes` against the configured max (§19/§15) **before** issuing the pre-signed URL; the URL itself is short-lived (e.g. 5 minutes) |
| POST | `/media/:serviceId/images` | Admin, or Provider +ownership | `{ key, alt, sortOrder }` | `ServiceImage` | Called after the browser's direct S3 upload succeeds, to attach the resulting key as a `service_images` row (§15, AWS Architecture doc) |
| DELETE | `/media/images/:id` | Admin, or Provider +ownership (of the parent service) | — | `{ success: true }` | Deletes the `service_images` row; whether the underlying S3 object is deleted immediately or garbage-collected later is a Phase 3 implementation detail |

---

## Summary: list-endpoint filtering/sorting/pagination reference

| Endpoint | Filters | Sort | Paginated |
|---|---|---|---|
| `GET /services` | `productId`, `categoryId`, `cityId`, `serviceTypeId`, `featured`, `mostBooked` | `sortOrder` (default), `name`, `offerPrice` | Yes |
| `GET /offers` | `cityId`, `serviceId`, `categoryId` | — | Yes |
| `GET /admin/listings/pending` | — | `createdAt` (default) | Yes |
| `GET /admin/orders` | `status`, `cityId` | `createdAt` (default) | Yes |
| `GET /orders` (Customer) | `status` | `createdAt` (default) | Yes |
| `GET /provider/listings` | `status` | `createdAt` (default) | Yes |
| `GET /admin/customers`, `/admin/providers` | `search` | `createdAt` (default) | Yes |

---

**Cross-reference:** every endpoint's exact role/ownership requirement is governed by `PHASE_2_AUTHORIZATION_MATRIX.md` §5, which this document's "Auth" columns summarize but do not restate in full. Error response shapes follow `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §18. Table/column names referenced above are defined in `PHASE_2_BACKEND_DATABASE_SCHEMA.md`.

**Not implemented in this phase.**

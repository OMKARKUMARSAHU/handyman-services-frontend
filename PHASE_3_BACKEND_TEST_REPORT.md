# Phase 3 Backend — Test Report

**Project:** Handyman Services Marketplace — Backend
**Scope:** Automated test results for the Phase 3 backend implementation
**Companion document:** `PHASE_3_BACKEND_IMPLEMENTATION.md` (architecture, endpoints, and design decisions)
**Last verified run:** `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` — all clean/passing, re-confirmed on 2026-10-01 after the Offer/pricing correction (§3's `offer-pricing.test.ts` and the migration-cycle re-run in §6 are new in this revision; everything else below from the original implementation is unchanged and was re-verified alongside it)

This report is intended to be maintained: re-run the four commands above after any backend change and update the numbers below if they move.

---

## 1. Summary

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Clean — 0 errors |
| `npm run lint` (ESLint, legacy config, backend-scoped) | Clean — 0 errors, 0 warnings |
| `npm run build` (`tsc -p tsconfig.json`) | Clean — 0 errors |
| `npm test` (Jest, `--runInBand`, real disposable MySQL DB) | **90 / 90 tests passing, 11 / 11 suites passing** |

No test is skipped, marked `.todo`, or mocked at the boundary that matters for its scenario (auth verification and S3 presigning are exercised for real — see §3).

---

## 2. Test environment

- Tests run against a **real, disposable MySQL database** (`handyman_test`, via `DB_TEST_NAME`), fully migrated with the same Knex migrations used for `handyman_dev` (now 13 — the Offer/pricing correction added two, see §6) — never against the real RDS instance (`database-1`). `tests/helpers/db.ts` truncates all 23 tables before each test (`beforeEach`), so every test starts from a known-empty state and tests do not leak state into one another.
- **Cognito JWT verification is genuinely exercised, not mocked.** `tests/helpers/cognitoTestKit.ts` generates a real RSA keypair at test-suite startup, hand-signs RS256 JWTs shaped like real Cognito tokens (`iss`, `client_id`, `token_use`, `cognito:groups`, `exp`, etc.), and installs the keypair's public JWK into the real `aws-jwt-verify` `CognitoJwtVerifier` via its own `.cacheJwks()` API — the same verifier class used in production. This means the auth middleware's actual signature-verification, issuer-check, expiry-check, and client-id-check logic runs in every test, with zero network calls and zero stubbing of the verification function itself.
- **S3 pre-signed URL generation is genuinely exercised, not mocked.** `.env` supplies local fake AWS credentials (`test-local-access-key` / `test-local-secret-key`) and a fake bucket name; `@aws-sdk/s3-request-presigner`'s `getSignedUrl()` performs real local SigV4 signing against those values with no network call, so the media module's actual validation-then-sign code path runs end-to-end in tests. What is *not* tested is a real object actually landing in a real S3 bucket (see §5) — that requires real AWS credentials Phase 3 does not have.
- Test run is serialized (`--runInBand`) because suites share one database.

---

## 3. Suite-by-suite results

### `auth.test.ts` — authentication (8/8 passing)
Verifies the Cognito JWT verification pipeline itself, independent of any specific route's authorization rules:
- rejects a request with no `Authorization` header
- rejects a malformed `Authorization` header (not a `Bearer` token)
- rejects a token signed with the wrong private key
- rejects an expired token
- rejects a token with an unrecognized issuer
- rejects a token whose `client_id` is not one of the configured app clients
- rejects a valid, correctly-signed token that carries no recognized role group
- accepts a genuinely valid customer token and just-in-time provisions the local `customers` row

### `authorization.test.ts` — role and ownership authorization (8/8 passing)
Verifies `requireRole()` and `requireOwnership()` independent of any one module's business logic:
- blocks a customer-role token from an admin-only route
- blocks a provider-role token from an admin-only route
- allows an admin-role token onto an admin-only route
- never grants access based on a client-claimed role — only the token's verified group claim decides
- prevents one provider from editing another provider's listing (ownership check)
- lets the owning provider edit their own listing
- returns 404 (not 403) for an ownership check against a resource that does not exist, so a non-owner learns nothing about whether it exists
- prevents a customer from reading another customer's saved address

### `approval.test.ts` — shared approval queue (7/7 passing)
Verifies the single-queue design that both Admin- and Provider-created listings share:
- a Provider-created listing starts as `pending_approval` and is hidden from the public catalog
- an Admin-created listing **also** starts as `pending_approval` — never auto-published, confirming there is no bypass for Admin-created content
- both Provider- and Admin-created listings appear in the **one** shared approval queue
- a Provider cannot reach the approval queue or approve/reject anything
- Admin approving a pending listing (Provider- or Admin-created) makes it publicly visible
- Admin rejecting a pending listing records the rejection reason and keeps it out of the public catalog
- a Provider editing their own already-approved listing forces it back to `pending_approval` — a Provider can never publish an edit directly

### `catalog.test.ts` — public catalog visibility and pricing (5/5 passing)
- excludes `pending_approval`, `rejected`, and inactive listings from the public list
- excludes an approved-but-inactive listing from the public list
- computes `discountPercent`/`discountAmount` from `mrp` and `offerPrice` exactly like the shared pricing helper
- only returns a service for a given city when it is actively offered there (service–city relationship, no per-city duplication)
- returns 404 for an unknown service slug rather than leaking any internal detail

### `cart.test.ts` — cart (6/6 passing)
- rejects every cart endpoint for an unauthenticated caller (server cart is authenticated-customer-only, per the Design-A hybrid cart)
- rejects adding a service that is not offered in the given city
- adds an item, and adding the same (service, city) pair again sums the quantity rather than duplicating the row
- updates quantity and removes an item
- flags a cart item as unavailable once its underlying service is deactivated, and excludes it from the subtotal
- merges a local (anonymous) cart into the server cart at login, skipping items that are no longer purchasable

### `orders.test.ts` — orders (8/8 passing)
The most security-critical suite; verifies that the server, never the client, is the source of truth for pricing and totals:
- an order **cannot be created by an unauthenticated caller under any circumstances**
- rejects order creation when the customer's cart is empty
- creates an order with server-computed totals, snapshots the delivery address, and clears the cart transactionally
- **re-fetches the live price at order time** rather than trusting the price cached in the cart row
- **never lets a client-submitted price/total influence the created order** (a forged/tampered price or total in the request body is ignored; the server-computed value wins)
- returns the same order when the same idempotency key is submitted twice, without creating a duplicate
- prevents a customer from viewing another customer's order (403, ownership-checked)
- lets Admin list all orders and update an order's status

### `offers-search.test.ts` — offers and search (4/4 passing)
- only returns active (in date-range, scoped) offers to the public endpoint
- requires admin role to create an offer
- `/search` finds matching categories, products, and approved+active services by name substring
- `/search` excludes an unapproved service from results — search never leaks pre-approval content

### `offer-pricing.test.ts` — Offer applicability, priority, and combined pricing (28/28 passing) — **new, added by the Offer/pricing correction**
Covers the correction brief's full scenario list (schema validation, applicability resolution, priority/no-stacking, combined discount math, and order-time snapshotting/tamper-resistance):

**Schema validation (11 tests)** — allows an `ALL_INDIA` offer with `cityId` omitted; requires a `cityId` for a `CITY` offer; rejects an `ALL_INDIA` offer that also specifies a `cityId`; accepts a `CITY` offer with a valid `cityId`; rejects a `cityId` that doesn't reference a real city; rejects a percent discount over 100; rejects an end date before the start date; rejects an offer scoped to a nonexistent service id; rejects an inconsistent applicability/cityId combination introduced by a PATCH; allows a consistent PATCH that switches applicability and clears cityId together; Admin can read one offer and list every offer regardless of city.

**Applicability resolution (3 tests)** — an `ALL_INDIA` offer applies in every city a service is available in; a `CITY` offer applies only in its own city, never another; the public `GET /offers?cityId=` endpoint never leaks one city's `CITY` offer into a different city's context.

**Priority / no-stacking (3 tests)** — the correction brief's own multi-city example (Ranchi/Delhi each get their own `CITY` offer, a third city falls back to the `ALL_INDIA` offer); a matching `CITY` and `ALL_INDIA` offer are never both applied, only the `CITY` one; two ambiguous `CITY` offers for the same city resolve deterministically (most-recently-created wins, via a dedicated `seq` column — see `PHASE_3_BACKEND_IMPLEMENTATION.md` §8) rather than stacking.

**Combined pricing math (7 tests)** — flat-offer calculation; percentage-offer calculation against the service's **offer price**, never the raw `mrp`; final price never goes negative (a discount larger than the base consumes the whole base); an inactive offer is ignored; an offer outside its date range is ignored; service/category scope is respected; a service unavailable in the selected city cannot use that city's offer (404).

**Order integration (4 tests)** — the created order snapshots the effective offer and the full combined-discount breakdown onto each line item; order creation recalculates pricing from the database rather than trusting the cart's own (possibly stale) display pricing; client-submitted discount/offer fields in the request body have zero effect; a historical order's pricing is unchanged even after BOTH the service's price and the referenced offer's discount are edited afterward.

### `media.test.ts` — S3 pre-signed upload flow (8/8 passing)
- rejects an unsupported content type before issuing a pre-signed URL
- rejects a file over the configured size limit (`S3_MAX_UPLOAD_BYTES`)
- issues a pre-signed URL to the owning provider for their own pending listing
- blocks a different provider from requesting an upload URL for someone else's listing
- blocks the owning provider from managing media once their listing is approved (Provider media rights are pending/rejected-only; Admin is unrestricted)
- lets Admin manage media on any listing regardless of approval status
- attaches an image record after a successful upload, then allows the owner to delete it (DB row removed, best-effort S3 object delete attempted)
- rejects media routes entirely for a customer-role token

### `content.test.ts` — admin-managed content (4/4 passing)
- only shows approved testimonials publicly, while Admin sees everything (including unapproved)
- blocks a customer from writing FAQs, homepage sections, contact info, or branding
- creates and reads back a homepage section by its stable key
- upserts the singleton contact info and branding records

### `users.test.ts` — generic `/me` (4/4 passing)
- returns the customer shape for a customer token
- returns the provider shape for a provider token
- returns a claims-derived shape for an admin token (no `admins` table backs it, by design — see `src/modules/admins/NOT_IMPLEMENTED.md`)
- rejects an unauthenticated request

---

## 4. Coverage by required scenario category

The Phase 3 brief required test coverage across eight categories. All eight are covered:

| Category | Covered by |
|---|---|
| AUTH | `auth.test.ts` (8 tests) |
| AUTHORIZATION | `authorization.test.ts` (8 tests) |
| APPROVAL | `approval.test.ts` (7 tests) |
| PRICING | `catalog.test.ts` (pricing computation), `orders.test.ts` (server-side re-fetch and anti-tampering), `offer-pricing.test.ts` (combined service+offer pricing, priority, snapshotting) |
| CART | `cart.test.ts` (6 tests) |
| ORDERS | `orders.test.ts` (8 tests), `offer-pricing.test.ts`'s order-integration tests (4 tests) |
| MEDIA | `media.test.ts` (8 tests) |
| CATALOG | `catalog.test.ts` (5 tests), `offers-search.test.ts` (4 tests), `offer-pricing.test.ts` (28 tests), `content.test.ts` (4 tests) |

---

## 5. What is explicitly NOT covered, and why

Per the same honesty standard used throughout the implementation, this is a complete list of gaps — none are hidden:

- **Real AWS RDS.** All database tests run against a disposable local MySQL database. The actual RDS instance (`database-1`) was never connected to or modified in any way during Phase 3, per the explicit database-safety requirement. Its current data state must be confirmed by someone with real access before any real migration is run against it.
- **Real AWS Cognito.** JWT *verification* is genuinely tested against a real verifier class with a locally-generated keypair (see §2), but no test calls real Cognito APIs (sign-up, sign-in, admin-disable-user, etc.) — Phase 3 has no real User Pool credentials to call them with. `authenticate()`'s contract with real Cognito tokens is unchanged; only the token *source* differs between test and production.
- **Real Amazon S3.** Pre-signed URL *generation* is genuinely tested (real SigV4 signing, see §2), but no test uploads an actual object to a real bucket, because no real bucket exists yet in this phase. The generated URL's shape and signature are correct; whether a subsequent `PUT` to that URL succeeds against a real bucket with matching CORS/IAM configuration is untested.
- **Real payment gateway.** None exists (see `src/modules/payments/NOT_IMPLEMENTED.md`); `payment_status` is set to `not_applicable` on every order and no payment test scenario applies yet.
- **Full AWS infrastructure (ECS Fargate, ALB, networking).** Not built in Phase 3 by design (infrastructure is explicitly out of scope for this phase); nothing to test.
- **Load, concurrency, and performance testing.** Out of scope for Phase 3; the test suite validates correctness, not throughput or race conditions under concurrent load (the idempotency-key mechanism is tested for the sequential-duplicate case, not for two truly concurrent requests racing each other).
- **Frontend integration.** No test in this suite touches the Next.js frontend; the backend is tested as a standalone HTTP API.

---

## 6. How to re-run

```bash
cd backend
npm run typecheck
npm run lint
npm run build
npm test              # requires DB_HOST/DB_USER/DB_PASSWORD/DB_TEST_NAME configured in .env,
                       # pointing at a local, disposable MySQL server — never RDS
```

All four commands must stay clean before any further phase begins.

**Migration validation (re-run for the Offer/pricing correction's two new migrations, 000012/000013):** `migrate:latest` → `migrate:rollback --all` → `migrate:latest` again → `migrate:status`, against both `handyman_dev` and `handyman_test` (freshly recreated databases) — all 13 migrations applied cleanly, rolled back cleanly, and re-applied idempotently each time; `migrate:status` reports all 13 completed, none pending. The new `offers.applicability_type`/`city_id` `CHECK` constraint was also confirmed to actually reject an invalid combination at the database level (not just in application code) by a direct `INSERT` against `handyman_test`.

**Note on `npm test` determinism:** the first version of the "ambiguous CITY offers" tie-break test (§3) was itself flaky — two offers created back-to-back in the same test could land in the same second, and the original tie-break (`ORDER BY created_at DESC`) could then pick either one nondeterministically. This was caught by running the full suite three times in a row and seeing one in roughly three runs fail. The fix was a dedicated `seq` auto-increment column (migration 000012) that can never tie, not a test-only workaround — the suite has since passed cleanly across multiple repeated full runs.

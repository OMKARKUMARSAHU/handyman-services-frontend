# Phase 2 — Phase 3 Implementation Plan
## Handyman Services Marketplace

**Status:** Planning only at the time this document was written. **This sequence has since been executed — Phase 3 (including the Offer/Pricing correction) is complete and approved.** The step-by-step prerequisites below are kept for historical traceability of the build order actually followed; the specific open-question items they name as blocking (1, 15, 19, 20, 21) are now **RESOLVED** per `PHASE_2_BACKEND_OPEN_QUESTIONS.md` and implemented exactly as decided there — do not read the "prerequisite" language below as still-open. Item 27 (approved-listing edit policy, named in step 7) remains genuinely open as a confirmed business policy, though Phase 3 already runs with a working default for it.

Each step below names its prerequisite open questions (if any) and which companion document governs its detailed design.

---

## 1. Backend project bootstrap

Initialize the backend codebase (Node.js/TypeScript per `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §2–3), project structure mirroring the API module boundaries in `PHASE_2_BACKEND_API_CONTRACT.md` (catalog, cart, orders, admin, provider, media — one module per concern, echoing the existing frontend's own `src/lib/data/*` boundary). No external dependency on AWS yet at this step — local/dev-only scaffolding.

## 2. Database migration system

Set up a migration tool (e.g. a TypeScript-first migration runner consistent with the chosen backend framework) before writing any schema — every table in `PHASE_2_BACKEND_DATABASE_SCHEMA.md` should be created via a tracked, reversible migration, never applied by hand against RDS.

## 3. Database schema

Apply the full schema from `PHASE_2_BACKEND_DATABASE_SCHEMA.md` §6–14 via the migration system above, against a **dev** database first (per the environment strategy in `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §24) — never directly against the production `database-1` instance at this stage. **Prerequisite:** item 20 in `PHASE_2_BACKEND_OPEN_QUESTIONS.md` (Admin content scope) should be resolved before this step, since it determines whether the content tables (`testimonials`, `faqs`, etc.) are included in the initial migration set.

## 4. Cognito integration

Configure the Groups (`customer`/`admin`/`provider`) and the two app clients (Customer; Admin/Provider) inside the **existing** User Pool, per `PHASE_2_AUTHORIZATION_MATRIX.md` §4 — this is a configuration of an existing resource, not a new pool. **Prerequisite:** item 1 (sign-in method) and item 26 (MFA) in the open-questions doc should be resolved first, since they determine the exact sign-up/sign-in flow and attribute requirements implemented here.

## 5. Authorization middleware

Implement the JWT-verification → identity → role → ownership → permission pipeline specified in `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §17, wired to the Cognito configuration from step 4. This is a cross-cutting concern built once and applied to every protected route thereafter — every subsequent API-building step (6–10) depends on this existing first.

## 6. Catalog APIs

Implement the PUBLIC endpoints from `PHASE_2_BACKEND_API_CONTRACT.md` (cities, categories, products, service types, services, offers, search) against the schema from step 3 — no authentication required, so this can proceed in parallel with steps 4–5 if useful, but should land before step 7 since Provider listing creation needs the catalog tables (products, service types, cities) already populated/queryable.

## 7. Provider APIs

Implement the Provider-role endpoints (own profile, create/edit listing, view own listings + status) per `PHASE_2_BACKEND_API_CONTRACT.md` and the approval-workflow fields/state machine in `PHASE_2_BACKEND_DATABASE_SCHEMA.md` §9. **Prerequisite:** step 5 (authorization middleware) and a resolved item 27 (edit-policy for an approved listing) from the open-questions doc.

## 8. Admin approval APIs

Implement the Admin-role endpoints — catalog CRUD, pricing, offers, city availability, and specifically the approval queue (`GET /admin/listings/pending`, approve/reject) — per `PHASE_2_BACKEND_API_CONTRACT.md` and `PHASE_2_AUTHORIZATION_MATRIX.md` §5. **Prerequisite:** item 21 (Admin-authored-listing auto-approval) should be confirmed before this step, since it affects the "create service" handler's default `approval_status`.

## 9. S3 upload APIs

Implement the pre-signed-upload flow (`POST /media/upload-url`, `POST /media/:serviceId/images`, `DELETE /media/images/:id`) per `PHASE_2_AWS_ARCHITECTURE.md` §15 — this is the first step that touches real AWS resources beyond RDS/Cognito, so it should follow the AWS resource creation in the Deployment-preparation step (16) for the IAM role/bucket-policy wiring to exist, even though the *code* for this step can be written earlier against a local/mocked S3-compatible interface.

## 10. Cart APIs

**Prerequisite, hard-blocking:** item 15 in the open-questions doc (guest checkout vs. login-required) must be resolved before this step — it determines whether Design A (hybrid) or Design B (server-only) from `PHASE_2_BACKEND_DATABASE_SCHEMA.md` §12 is implemented. Building this step before that confirmation risks building the wrong design and discarding work.

## 11. Order APIs

Implement `POST /orders`, `GET /orders/:id`, `GET /orders` per `PHASE_2_BACKEND_API_CONTRACT.md`, including the price/address snapshotting behavior from `PHASE_2_BACKEND_DATABASE_SCHEMA.md` §10/§13 and the idempotency requirement from §14/§19 of the System Architecture doc. Depends on steps 6 (catalog, for price lookups at order-creation time) and, if server-cart is built, step 10.

## 12. Payment abstraction

Implement only the boundary described in `PHASE_2_BACKEND_DATABASE_SCHEMA.md` §14 — the `payments` table and a generic adapter interface — with **no real gateway integration**, since the gateway remains `TBD / CLIENT CONFIRMATION REQUIRED` (item 2, open-questions doc). This step should not be blocked waiting for gateway selection; the boundary can and should be built now so a real gateway can be plugged in later without a schema change.

## 13. Validation

Apply the schema-based input validation described in `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §19 across every write endpoint built in steps 6–12 — ideally built incrementally alongside each endpoint rather than retrofitted at the end, but called out as its own step per the brief's sequencing so it isn't silently skipped under time pressure.

## 14. Logging

Wire the structured CloudWatch logging described in `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §21 (request ID, route, role, status, latency) into the authorization middleware (step 5) and every controller, so it's present from the first deployed endpoint rather than added retroactively.

## 15. Tests

Automated tests per endpoint/module (unit tests for validation/pricing-derivation logic per `PHASE_2_BACKEND_DATABASE_SCHEMA.md` §10, integration tests for the authorization matrix per `PHASE_2_AUTHORIZATION_MATRIX.md` §5 — particularly the ownership-check paths, since those are the highest-risk-of-regression area — and a smoke test of the full catalog-browse → cart → checkout flow against a seeded dev database).

## 16. Deployment preparation

Create the AWS resources listed as "New" in `PHASE_2_AWS_ARCHITECTURE.md` §26 (VPC verification/subnets, ECS Fargate cluster/service, ALB, NAT Gateway, ACM certificate, Secrets Manager entries, IAM roles) and the DNS record per §23 — **only after** the client has approved the Phase 2 checklist and explicitly authorized this specific resource creation, per the "do not create AWS resources" boundary that governs this entire Phase 2 package. This step is the actual point at which Phase 2's proposals become real infrastructure; everything before it in this list can be built/tested against a local or dev-only environment without needing any new AWS resource to exist yet.

---

**This sequence has since been executed.** It was the Phase 3 roadmap, and the open-question prerequisites it named have since been resolved (see the status note at the top of this document) — kept here as the historical record of the planned build order.

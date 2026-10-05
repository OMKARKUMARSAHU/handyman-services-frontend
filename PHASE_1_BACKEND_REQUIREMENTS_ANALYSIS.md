# Phase 1 — Backend Requirements, Architecture & AWS Resource Analysis

**Status:** Planning/analysis only. No backend code was written, no AWS resources were created, no RDS configuration was changed, no security groups were changed, and no existing frontend file was modified to produce this document. This document is the required deliverable of this phase and nothing beyond it.

**Scope of this phase:** analyze the existing Next.js frontend (currently mock-data/localStorage-only, deployed on Vercel) together with the client's confirmed backend requirements and already-provisioned AWS resources, and produce a complete requirements/architecture analysis that Phase 2 (actual backend implementation) can be scoped from. Every open business rule is marked `TBD / CLIENT CONFIRMATION REQUIRED` rather than assumed.

---

## A. Confirmed Client Requirements

1. **Roles.** Three roles exist: **Customer**, **Admin**, **Service Provider**.
2. **Authentication provider.** Amazon Cognito is the authentication system for all three roles (already provisioned — see §B).
3. **Login entry points.** Customer has its own, separate login. Admin and Service Provider share **one common login entry point**; the backend determines the authenticated user's role after sign-in and routes/authorizes accordingly (the frontend/backend does not present two different admin-vs-provider login screens).
4. **Service Provider workflow.** A Service Provider can create/list products or services. A newly created listing is **not** immediately public — it is created with a `pending_approval` status. Admin reviews it and approves or rejects it. Only approved/published listings are ever visible to customers.
5. **Admin role.** Admin represents the company owner/operator. Admin manages the catalog, content, and pricing, and approves or rejects Service Provider listings. **Pricing and catalog data must be database-driven** — never hardcoded in the frontend (this is already true of the current mock build, see §B.4, and must remain true of the real backend).
6. **Payment.** Payment gateway and credentials are **to be provided later**. No payment provider may be invented or assumed at this stage.
7. **Media.** Images/videos/media live in Amazon S3. Binary media must **never** be stored in MySQL — MySQL stores only metadata/references/URLs/keys.
8. **Domain and hosting split.** Domain `handymanservices.in` is managed via GoDaddy. The frontend is deployed on Vercel. The backend/API will be hosted on AWS once the architecture below is finalized.
9. **Authorization to build.** The client has authorized creating the AWS resources required for this project (subject to the explicit "not yet" list in §A.10 below).
10. **Explicit prohibitions for this phase** (restated verbatim from the brief, binding on this document and on Phase 2 until lifted by the client):
    - Do NOT write backend application code.
    - Do NOT modify the existing frontend application.
    - Do NOT modify the existing RDS configuration.
    - Do NOT create EC2 or any additional production AWS resources yet.
    - Do NOT change security groups yet.

---

## B. Existing AWS Resources (as provided by the client)

| Resource | Detail |
|---|---|
| **Amazon Cognito** | Provisioned, for Customer / Admin / Service Provider authentication. Pool structure, app clients, and group design are not yet finalized — see §C.4. |
| **Amazon RDS for MySQL** | Identifier `database-1`. Engine: MySQL Community. Instance class: `db.t4g.micro`. Region: `ap-south-1` (Mumbai). Status: Available. Public accessibility: **disabled**. Inbound currently restricted to the operator's current IP (`/32`). Outbound: `0.0.0.0/0`. |
| **Amazon S3** | Provisioned, for images/videos/media. Bucket policy, prefix structure, and access pattern (public-read vs. signed URLs/CloudFront) are not yet finalized — see §C.20. |

**B.4 — Existing frontend, as actually built (read directly from the codebase, not assumed):**

- Next.js 16 (App Router) frontend, deployed on Vercel. Entirely **mock-data/client-state today** — there is no live backend it currently talks to.
- Every catalog read (cities, categories, products, service types, services, offers, testimonials, FAQs, etc.) goes through a Data Access Layer under `src/lib/data/*.ts`, one module per entity, already documented in `PHASE_2_API_CONTRACT.md`. Components never read business data directly. This convention is the reason a real backend can be dropped in behind the same function signatures without a UI rewrite, and Phase 2's backend API design should mirror this module boundary (see §C.32).
- The data shapes in `src/types/index.ts` (`City`, `Category`, `Product`, `ServiceType`, `Service`, `ServiceImage`, `ServiceCityAvailability`, `Offer`, `Customer`, `Address`, `Cart`/`CartItem`, `Order`/`OrderItem`, `ServiceProvider`, `Plan`, `Testimonial`, `FAQ`, etc.) are the existing, client-approved contract between UI and data layer (`PHASE_2_DATA_ARCHITECTURE.md`). These are the starting point for the relational schema in §C.31, not a from-scratch design.
- **Cart** (`src/lib/state/CartProvider.tsx`) is genuine client-local state today — held in React context and persisted to the browser's `localStorage`, not a mock stand-in for a network call. It is deliberately not `async`.
- **Checkout/orders** (`src/lib/data/orders.ts`) is a mock: `createOrder()` validates the payload, simulates latency, computes totals from the mock catalog, and writes the resulting `Order` to the browser's `localStorage` only (key `handyman:orders`) so the confirmation page can read it back. There is no server-side order store today. `Order.paymentStatus` is hardcoded to the literal `"not_applicable_mock"` because no payment step exists yet.
- **Authentication does not exist yet on the frontend.** `/login` and `/account` are intentionally honest UI shells ("Account sign-in isn't turned on yet... you can still browse, add to cart and book as a guest") — there is no sign-in form, no session, no `Customer` record created anywhere. Checkout is guest-only today (`customerId: undefined` is passed explicitly, with a comment pointing at the still-open guest-checkout question).
- There is no Admin UI and no Service Provider UI in the frontend today. Nothing in the current codebase creates, approves, or rejects a listing.
- Known **open business rules already flagged by the client/Phase 2 planning**, restated here because they affect backend design directly: guest-cart-vs-login-required (Open Question #17), multi-city cart behavior (Open Question #24), `Offer` vs. `Service.offerPrice` stacking precedence (Open Question #25), booking slot rules, payment gateway, coupons, wallet, refunds/cancellations, provider assignment logic, live tracking, notifications, and whether reviews are in scope. These are carried into §E rather than re-decided here.

---

## C. Recommended Architecture

### 1. Backend scope

The backend's job is to become the **one and only** application layer that talks to MySQL, Cognito (for authorization decisions), and S3 (for issuing/validating media access), replacing today's mock `src/lib/data/*` implementations one function at a time without requiring a frontend rewrite (this is the explicit migration path `PHASE_2_API_CONTRACT.md` §8 already commits to). In scope for Phase 2 planning: catalog CRUD (Admin-driven), Service Provider listing submission + Admin approval workflow, cart/checkout/order persistence, address management, authenticated role-based access, and media upload/reference handling via S3. Out of scope until confirmed: payment processing, notifications, live provider tracking, reviews, coupons, wallet (§E).

### 2. Recommended backend architecture

A single, centralized **REST API service** ("the backend API"), written in Node.js/TypeScript (recommended for schema/type continuity with the existing `src/types/index.ts` contract — the same interfaces can be shared or mirrored on the backend, reducing drift), running entirely inside AWS, in a **private subnet** alongside RDS. The frontend (Vercel) never talks to MySQL, Cognito's admin APIs, or S3 credentials directly — it only ever calls this backend API over HTTPS (§C.28). This satisfies the client's "backend must be the sole application layer touching the database" rule and the existing frontend's own "no component reads business data directly" principle, just moved one layer down (frontend DAL → real network calls → backend API → database).

Compute hosting for this API is **not selected yet** (no EC2 or other compute is being created in this phase) — §C.24 lays out the options and trade-offs for that decision, to be made explicitly before Phase 2 begins building.

### 3. API architecture

Recommend a versioned REST API (e.g. `/api/v1/...`) rather than GraphQL: the existing frontend's Data Access Layer is already organized as discrete, purpose-built read/write functions per entity (`getServicesByProduct`, `createOrder`, etc.) — REST resources map onto that 1:1, while GraphQL would introduce a query layer the frontend doesn't currently need and would add backend complexity with no confirmed benefit. Module boundaries should mirror `PHASE_2_API_CONTRACT.md` exactly: catalog reads, search, cart, checkout/order, auth-dependent reads, and admin-facing writes — see §C.32 for the concrete endpoint list. Responses should use the same field names/shapes as `src/types/index.ts` wherever the entity is shared, so the frontend's existing TypeScript types keep working with minimal remapping.

### 4. Cognito authentication architecture

Recommend **one Cognito User Pool** shared by all three roles, not three separate pools. The client's own requirement — "Admin and Service Provider share one common login entry point; the backend determines role after auth" — is architecturally the single-pool, role-as-group pattern: role membership is expressed as a **Cognito Group** (`customer`, `admin`, `provider`) or a **custom attribute** (`custom:role`) on the user, not as a separate identity system per role. Cognito issues a JWT (ID token/access token) after sign-in; the backend reads the group/custom attribute claim out of that token to determine the role — it does not need to guess or ask again. A single pool also avoids the operational overhead of syncing three separate user directories, three separate password/MFA policies, and three separate "forgot password" flows, with no confirmed business reason (yet) to justify that split. If a future confirmed requirement needs materially different auth policies per role (e.g., mandatory MFA for Admin only), Cognito Groups still support per-group IAM/precedence settings without needing separate pools — so this is not a decision that forecloses that option.

Two separate **app clients** are recommended within the one pool: one for the Customer-facing login flow, one for the shared Admin/Provider login flow — this matches the client's stated "two entry points, one determines role" shape without needing two pools.

The exact sign-in method (email+password, phone+OTP, or both) is **not decided** — Cognito supports all three; this is Open Question #1 (carried from Phase 1 §19) and must be confirmed before the sign-up/sign-in screens are built (§E).

### 5. Role-based authorization

Cognito authenticates (proves who the user is); it does not itself decide what a Customer vs. an Admin vs. a Provider is allowed to do inside this specific application's business logic — that is the backend's job. Recommended pattern: every backend API request carries the Cognito-issued JWT; a shared authorization middleware verifies the token's signature/expiry (via Cognito's public JWKS, cached), extracts the role claim, and enforces per-route role checks (e.g., only `admin` may call the "approve listing" endpoint; only `provider` may call "create my listing"; only the owning `customer` may read their own orders/addresses). This authorization logic lives entirely in the backend, never in the frontend and never assumed from a Cognito group alone without a server-side check on every request — a JWT's claims are trustworthy once signature-verified, but the authorization *decision* (is this role allowed to do this specific thing to this specific resource) is application logic the backend must own explicitly.

### 6–8. Customer / Admin / Service Provider workflows

- **Customer:** browse catalog (no login required, matching today's guest-browsing UX) → add to cart (guest cart today; whether it must merge into an account cart on login is Open Question #17, §E) → sign in (Customer-specific Cognito flow) at checkout if login-before-checkout is confirmed, or continue as guest if guest checkout is confirmed → place order → view own order history/addresses (requires login). None of this requires new business rules beyond what §E already tracks as open; the backend simply needs to expose the endpoints in §C.32 once those calls are confirmed.
- **Admin:** signs in via the shared Admin/Provider entry point → backend recognizes the `admin` role/group → gains access to: catalog CRUD (categories, products, service types, services, cities, city-availability, offers, pricing), the pending-listing approval queue (§C.9), and (implicitly, per the client's "manages catalog/content/pricing" statement) content management for the same marketing entities the frontend already renders (`Testimonial`, `FAQ`, `HomepageSection`, `ContactInfo`) — flagged here as an inferred scope extension, not a separate client statement, so confirm explicitly before building Admin content-management endpoints beyond catalog/pricing.
- **Service Provider:** signs in via the same shared entry point → backend recognizes the `provider` role/group → gains access to: create/edit their own product/service listings (which start `pending_approval`), view the approval status of their own listings, and — per the existing `ServiceProvider.assignedOrderIds` field already reserved in `src/types/index.ts` — a future view of orders assigned to them. Provider order-assignment logic itself is Open Question #7 (carried forward) and is not designed further here.

### 9. Provider listing approval workflow

Recommend a simple, explicit status field on the listing record (`Service.approvalStatus` or a new join concept — see §C.10) with these states: `pending_approval` → `approved` | `rejected`. Only `active: true` **and** `approvalStatus: "approved"` listings are ever returned by the customer-facing catalog read endpoints (§C.32) — this is a backend-enforced filter, not a frontend-trusted one, since the existing frontend catalog reads must never be given the option to accidentally render an unapproved listing. A rejected listing should retain a reviewer note field (`rejectionReason`) so the Provider can see why and resubmit — this is a reasonable, low-risk addition to the schema, not a client-confirmed requirement, so it's proposed here for Phase 2 review rather than assumed final. Who counts as the "owner" of an Admin-created vs. Provider-created listing (i.e., does Admin's own catalog work skip the approval step, since Admin *is* the approver) was assumed yes at this point in the analysis — Admin-authored listings publish directly — as the only self-consistent reading of "Admin approves Provider listings," pending explicit confirmation (§E). **This assumption was later found to be INCORRECT and is superseded**: the final client decision (`PHASE_2_BACKEND_OPEN_QUESTIONS.md` item 21) is that Admin-created listings go through the exact same `pending_approval` → shared approval queue as Provider-created listings, with Admin intentionally permitted to approve its own queue entries (self-approval by design, not a bypass). Implemented as such in Phase 3.

### 10–13. Product/catalog, Service, Category, City/service-availability architecture

These map directly onto the already-approved Phase 2 data model in `PHASE_2_DATA_ARCHITECTURE.md`/`src/types/index.ts`, with no redesign needed — only translation into relational tables (§C.31): `Category` (1) → `Product` (*) → `Service` (*), `Service` → `ServiceType` (many-to-one), `Service` ↔ `City` via the `ServiceCityAvailability` join table (many-to-many with an `active` flag per pair, exactly as already documented — "a service exists once; which cities it's offered in is a relationship, not a duplicated record"). The only addition Phase 2 backend work needs on top of this existing model is the approval-workflow fields from §C.9 and an explicit `createdByRole`/`createdByUserId` (or `providerId`/`adminId`) column on `Service`, since the existing type didn't need to track authorship in a mock/no-auth world but the real backend does, to know whose listing is whose.

### 14–15. Pricing and Offer architecture

`Service.mrp`/`Service.offerPrice` remain the stored source of truth; `discountPercent`/`discountAmount` remain **derived at read time** by the backend (porting the existing `lib/pricing.ts` calculation logic server-side), never stored, so an Admin price edit can never leave a stale discount — this is an explicit existing design principle (§B.4) and should not regress in the backend. `Offer` (promotional discount/banner) is modeled as its own table exactly as `src/types/index.ts` already defines it (`discountType`, `discountValue`, `appliesTo: {scope, ids}`, date range, `active`). **Whether an `Offer` stacks with, replaces, or is independent of a `Service`'s own `offerPrice` discount remains explicitly unresolved (Open Question #25)** — the backend must not implement automatic stacking; it should compute and return both figures and let a future confirmed rule decide how they combine.

### 16. Cart architecture

Recommend a **hybrid model**, consistent with how the current guest-first UX already works and with the still-open guest-checkout question (Open Question #17): the cart stays client-local (`localStorage`, as today) for anonymous browsing, and only becomes a server-persisted `Cart`/`CartItem` pair (tied to `Customer.id`) once the customer is authenticated — at which point the backend exposes cart read/write endpoints and the frontend's `CartProvider` would sync to them instead of (or in addition to) `localStorage`. This is a recommendation, not a client-confirmed decision, because it depends directly on Open Question #17 (is login required before cart, or only at checkout) — if the client confirms "login required before cart," a purely server-persisted cart from the start becomes simpler and this hybrid is unnecessary. **Do not build cart persistence in Phase 2 before Open Question #17 is confirmed.**

### 17. Order architecture

`Order`/`OrderItem` map directly onto `src/types/index.ts`, moved from the current `localStorage` mock into a real `orders`/`order_items` table pair. `Order.address` remains a **snapshot** (copied fields, not a live foreign key), exactly as already designed, so a later address edit never rewrites order history. `Order.customerId` remains nullable pending the guest-checkout decision (Open Question #17) — the backend schema should not make it `NOT NULL` until that is confirmed, to avoid a breaking migration later. `Order.status` remains an open lookup (`pending`, `confirmed`, `assigned`, `in_progress`, `completed`, `cancelled`) as already defined; the exact lifecycle/transition rules and who can trigger which transition are not decided here (ties into provider-assignment, Open Question #7).

### 18. Payment architecture

No payment gateway integration is designed or assumed in this phase — the client has explicitly stated gateway credentials are TBD and must not be invented. The only backend seam that should exist now is the already-reserved `Order.paymentStatus` string field, left as an open lookup (today's mock hardcodes `"not_applicable_mock"`; a real backend would use something like `"pending" | "paid" | "failed" | "refunded"` once a gateway is chosen). No payment endpoint, webhook handler, or client-side payment SDK should be built until the gateway is confirmed.

### 19. Address architecture

`Address` maps directly onto the existing type (`customerId` nullable to support a guest-checkout address, `label`, `line1`/`line2`, `city`, `state`, `pincode`, `isDefault`). Recommend the backend expose standard CRUD for a logged-in Customer's saved addresses, plus the ability for checkout to persist a one-off address snapshot onto the `Order` even without saving it as a reusable `Address` record — this mirrors the existing frontend's `AddressStep` behavior (an address is captured at checkout time regardless of login state).

### 20. Media/S3 architecture

Recommend the backend, not the frontend, brokers all S3 access: an Admin or Provider requesting to upload a service image calls a backend endpoint that returns a short-lived **pre-signed S3 upload URL** scoped to a specific key/prefix (e.g. `services/{serviceId}/{uuid}.jpg`); the browser uploads directly to S3 using that URL (so large media never transits the backend server itself); the backend then stores only the resulting **S3 object key/URL** in the `service_images` table's `url` column — exactly matching `ServiceImage`'s existing shape (`id`, `serviceId`, `url`, `alt`, `sortOrder`). For serving images back to customers, recommend fronting the S3 bucket with **CloudFront** (not yet created — §C.34) for caching/CDN performance and to avoid exposing the raw S3 bucket URL/structure publicly; whether the bucket is public-read behind CloudFront or requires signed CloudFront URLs is a cost/security trade-off to decide in Phase 2 (public-read is simpler and adequate for a services-catalog use case where images are meant to be publicly viewable; signed URLs add complexity with no confirmed requirement for restricted media access).

### 21. RDS/MySQL architecture

The existing `database-1` instance (`db.t4g.micro`, MySQL, `ap-south-1`) is the database of record; this phase does not propose replacing it. **Suitability evaluation, explicitly requested:** `db.t4g.micro` (2 vCPU burstable "Graviton" ARM, 1 GiB RAM) is appropriate for the current stage — development, initial backend build-out, and an early production launch with light traffic — because there is no real traffic yet and the schema in §C.31 is modest (a services marketplace catalog, not a high-write analytics workload). It is **not** sized for sustained production traffic at meaningful scale: 1 GiB RAM limits connection count and buffer pool size, and `t4g` burstable credits can throttle under sustained load (e.g., a marketing campaign spike). **Recommended scaling path**, to apply only when real usage data justifies it (not now): first, vertically resize to `db.t4g.small`/`db.t4g.medium` (or the equivalent non-Graviton `db.t3.*` if ARM compatibility becomes an issue) — a same-engine instance-class change with brief downtime or via a Multi-AZ failover; only after that, consider read replicas for read-heavy catalog traffic, and only much later consider a managed connection pooler (e.g. RDS Proxy) if the backend compute layer (§C.24) is a highly concurrent serverless design (Lambda) that would otherwise exhaust MySQL's connection limit. Enabling **Multi-AZ** for production availability, and RDS automated backups/snapshot retention (§C.27), are both recommended before real customer data exists in it, but are configuration changes to the existing instance, not new resources, and are explicitly **not being made now** per the "do not modify existing RDS configuration" instruction — they belong to the Phase 2 confirmation list (§E/§H).

Schema: one table per entity in §C.31, standard MySQL InnoDB, foreign keys enforced at the database level for referential integrity (e.g. `service.product_id → product.id`), matching the relationships already documented in `PHASE_2_DATA_ARCHITECTURE.md` §4.

### 22. AWS networking requirements

RDS is already non-publicly-accessible, which is correct and must remain so. For the backend API to reach it, the backend compute (§C.24) must run **inside the same VPC as RDS** (or a peered/connected VPC) and in a private subnet — the database should never be reachable from the public internet, only from the backend's own security group. Whether a VPC with appropriate private/public subnet layout already exists (created implicitly when RDS was provisioned) or needs explicit design (NAT Gateway for the backend's own outbound internet access, e.g. to call Cognito's public endpoints or third-party APIs) is not yet confirmed — this must be checked before Phase 2 compute is chosen, since it affects the compute options in §C.24 (e.g., Lambda inside a VPC has different cold-start/ENI characteristics than Lambda outside one).

### 23. Security group requirements

**Not changing security groups now**, per explicit instruction — this section documents the target end state only, for Phase 2 to implement once compute is chosen. Today's RDS inbound rule (a developer's current IP, `/32`) is explicitly a temporary development-access convenience, not a production design, and must **not** be treated as final. The correct end-state relationship: RDS's security group should allow inbound MySQL (3306) **only** from the backend compute's own security group (referenced by security-group ID, not by IP/CIDR) — no IP-based rule, no `0.0.0.0/0`, and no direct developer-machine access in production. A developer's temporary `/32` rule can remain for local development/debugging convenience but should be removed or restricted to a bastion/VPN-based access pattern once the backend is deployed, rather than kept as a standing production rule.

### 24. Backend compute requirements

No compute is being created in this phase. Three realistic options for Phase 2 to choose between, with trade-offs, since the brief explicitly asks this not be assumed:

| Option | Pros | Cons |
|---|---|---|
| **ECS Fargate** (containerized API, no server management) | Straightforward for a persistent Node.js REST API; predictable connection pooling to MySQL; easy to run inside the RDS VPC/private subnet; no cold starts | Slightly more setup (task definitions, ALB, ECR) than Lambda; always-on cost even at low traffic |
| **Lambda + API Gateway** (serverless) | Scales to zero cost at low/no traffic — attractive pre-launch; no server patching | Running inside a VPC (required to reach private RDS) adds cold-start latency; MySQL connection limits are easy to exhaust under concurrent invocations without RDS Proxy (an added resource/cost); less natural fit for a long-lived Node API with existing Express/Nest-style patterns |
| **EC2** | Full control | **Explicitly excluded from this phase and not recommended as a first choice generally** — it carries the most operational burden (patching, scaling) of the three, with no confirmed requirement that justifies it over a managed option |

**Recommendation to bring to Phase 2 for confirmation, not decided here:** ECS Fargate behind an Application Load Balancer, inside the RDS VPC's private subnets, is the best fit for a small-to-medium REST API with a relational database and no confirmed need for serverless's scale-to-zero economics yet. This is a recommendation for the client/Phase 2 kickoff to confirm, not an authorization to create it now.

### 25. Secrets management

Recommend **AWS Secrets Manager** (or, at minimum, SSM Parameter Store's `SecureString` type for a lower-cost start) for: the RDS master/application database credentials, Cognito app client secret (for the confidential app client, if used), and any future third-party API keys (payment gateway, once chosen). The backend compute's IAM role should be granted read access to only the specific secrets it needs; nothing resembling a database password or AWS access key should ever be shipped to or readable by the Vercel-hosted frontend — the frontend only ever holds the backend API's own base URL and, if applicable, a Cognito app client ID (public, non-secret) for initiating sign-in redirects.

### 26. Logging/monitoring

Recommend Amazon **CloudWatch** for backend application logs (structured JSON logs from the API), CloudWatch metrics/alarms on RDS (CPU, connections, storage, `t4g` credit balance — relevant given §C.21's burstable-instance caveat), and on the backend compute (error rate, latency, concurrency). Not building dashboards/alarms now — flagged as a Phase 2 setup task, not a resource-creation exception to the "no additional production resources yet" rule, since CloudWatch log groups are typically created implicitly by the compute service itself.

### 27. Backup requirements

RDS automated backups (point-in-time recovery) should be enabled with a defined retention window (7–14 days is a reasonable starting default, not client-confirmed) once the instance holds real data — this is a configuration change to the existing RDS instance and is explicitly **not being made in this phase**, consistent with "do not modify the existing RDS configuration." Manual/scheduled snapshots before any future schema migration are recommended practice for Phase 2, not a new AWS resource in the sense the prohibition is guarding against.

### 28. Vercel → AWS communication

The Next.js frontend calls the backend API over plain HTTPS, the same way any external API consumer would — there is no special Vercel↔AWS integration needed beyond a stable, CORS-configured backend endpoint. Recommend the backend sit behind its own custom subdomain (e.g. `api.handymanservices.in`, see §C.29) with a valid TLS certificate (AWS Certificate Manager, attached to the ALB or API Gateway custom domain) so the browser's requests from `handymanservices.in` (served by Vercel) to `api.handymanservices.in` (served by AWS) are a standard cross-origin HTTPS call with the backend's CORS policy explicitly allow-listing the frontend's origin(s) (production domain, and Vercel preview-deployment domains if those need to reach a staging backend — see §C.39). Server-side calls from Next.js (e.g. server components, `route.ts` handlers used only as a thin proxy) can also call the backend directly; no secrets are needed for this since the backend enforces its own auth via the Cognito-issued JWT the browser already holds.

### 29. GoDaddy DNS requirements

Current split: apex/`www` for `handymanservices.in` should point at Vercel per Vercel's own DNS instructions (an `A`/`ALIAS` record to Vercel's IP or a `CNAME` for `www`, per Vercel project settings — not re-specified here since it's Vercel's own documented mechanism, unrelated to AWS). A new subdomain, recommended `api.handymanservices.in`, needs a DNS record in GoDaddy pointing at whatever AWS front door is chosen for the backend (an ALB's DNS name via a `CNAME`, or — if a Route 53 hosted zone for the domain is later delegated from GoDaddy to AWS — an `ALIAS` record managed in Route 53 instead). Whether to keep DNS entirely in GoDaddy (simpler, fewer moving parts, `CNAME` to the ALB) or delegate the zone to Route 53 (more native AWS integration, useful if more AWS-hosted subdomains are anticipated) is a Phase 2 decision, not made here — GoDaddy `CNAME`-to-ALB is the lower-friction default recommendation given only one subdomain is needed today.

### 30. Required environment variables / secrets (indicative list for Phase 2, not exhaustive)

Backend (never exposed to the frontend): `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (or a Secrets Manager ARN in place of the literal value), `COGNITO_USER_POOL_ID`, `COGNITO_REGION`, `COGNITO_APP_CLIENT_ID` (and `..._SECRET` if a confidential client is used), `S3_BUCKET_NAME`, `S3_REGION`, `AWS_REGION`, and — once chosen — payment-gateway keys. Frontend (public, non-secret): `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID` (public client IDs are not secrets by design), `NEXT_PUBLIC_COGNITO_REGION`. Exact names are a Phase 2 implementation detail; listed here to confirm none of them require inventing an unconfirmed business decision (they don't — all are infrastructure identifiers).

### 31. Database entities required

Directly ported from `src/types/index.ts` / `PHASE_2_DATA_ARCHITECTURE.md`, plus the minimal additions Phase 2 needs for real auth/ownership/approval (marked *new*):

`cities`, `categories`, `products`, `service_types`, `services` (*+ `approval_status`, `rejection_reason`, `created_by_user_id`, `created_by_role`*), `service_city_availability`, `service_images`, `offers`, `customers` (*new — currently only a TBD type, needs real columns once the Cognito auth method, §E, is confirmed: at minimum `id`, `cognito_sub`, `name`, `phone`, `email`*), `addresses`, `carts`, `cart_items` (*only if the hybrid/server-cart design in §C.16 is confirmed*), `orders`, `order_items`, `service_providers` (*new — same treatment as `customers`: `id`, `cognito_sub`, `name`, `phone`*), plus the existing marketing/content entities if Admin content management is confirmed in scope (§C.6–8): `testimonials`, `faqs`, `contact_info`, `homepage_sections`, `nav_items`. `plans` (legacy Silver/Gold/Platinum) is retained as-is per the client's existing "legacy, pending decision" instruction — not rebuilt, not removed. `reviews` is **not** created until reviews are confirmed in scope (Open Question #10).

### 32. API modules/endpoints eventually required

Mirroring `PHASE_2_API_CONTRACT.md`'s existing module boundaries, translated from mock DAL functions into real backend REST endpoints:

- **Catalog (public reads):** cities, categories, products, service types, services (with city/type filters), featured/most-booked (pending Open Question #18), offers, search.
- **Cart:** get/add/update-quantity/remove/clear — scope pending §C.16/Open Question #17.
- **Checkout/Order:** create order, get order by id (for confirmation page), get my orders (authenticated Customer).
- **Auth-adjacent:** get current user/profile (role-aware — returns Customer, Admin, or Provider shape depending on the JWT's role claim); the sign-in/sign-up flow itself is handled by Cognito directly (via Amplify/Cognito Hosted UI or a custom Cognito SDK integration in the frontend), not by a custom backend "login" endpoint, since Cognito already is the identity provider.
- **Admin (role-gated):** catalog CRUD (categories/products/service types/services/cities/offers/pricing), listing approval queue (list pending, approve, reject with reason), and — if confirmed in scope — content management (testimonials/FAQs/homepage sections/contact info).
- **Service Provider (role-gated):** create/edit own listings, view own listings + their approval status, (future) view assigned orders.
- **Media:** request a pre-signed S3 upload URL (Admin/Provider only), attach the resulting key to a `service_images` row.

### 33. AWS resources already available

Restated from §B: Amazon Cognito (user pool exists; internal group/app-client structure not yet finalized), Amazon RDS for MySQL `database-1` (`db.t4g.micro`, `ap-south-1`, private), Amazon S3 (bucket exists; policy/prefix structure not yet finalized).

### 34. AWS resources still needed (proposed, not created in this phase — see §D)

- A confirmed VPC/subnet layout that places backend compute alongside RDS in private subnets (may already exist implicitly from RDS provisioning — needs verification, not assumed).
- Backend compute (ECS Fargate recommended, §C.24) — not created yet.
- An Application Load Balancer (or API Gateway, depending on the compute choice) as the backend's public entry point.
- AWS Certificate Manager TLS certificate for `api.handymanservices.in`.
- CloudFront distribution in front of the S3 media bucket (§C.20).
- AWS Secrets Manager (or SSM Parameter Store) entries for DB credentials and Cognito app secrets.
- CloudWatch log groups/alarms for the backend and RDS (§C.26).
- IAM roles/policies scoping backend compute to exactly the Secrets Manager entries, S3 prefixes, and Cognito admin actions (if any) it needs — least-privilege, not broad account access.
- A GoDaddy DNS record (or Route 53 delegation) for `api.handymanservices.in` (§C.29).

### 35. AWS resources that should NOT be created yet

Per explicit instruction: **no EC2 instance**, **no additional production AWS resources beyond what Phase 2 confirms**, and **no security group changes**. This also means: no RDS configuration change (Multi-AZ, backup retention, instance-class resize), no new Cognito user pool (the existing one should be extended/configured, not duplicated), and no production S3 bucket policy change until the media access pattern (§C.20) is confirmed. This phase is analysis only.

### 36. Security risks (current and to guard against in Phase 2)

- **RDS must never be made publicly accessible "to simplify development."** The current `/32` developer-IP rule is already a minimal-blast-radius temporary measure; the risk is that it gets widened (e.g. to `0.0.0.0/0`) under time pressure during backend development instead of routing developer access through a bastion/VPN or simply developing against a local/dev database. This should be treated as a hard rule, not a suggestion.
- **Never expose DB credentials or AWS secrets to the frontend.** The frontend (Vercel) must only ever hold public, non-secret identifiers (§C.30) — never a database password, an AWS access key, or a Cognito app client *secret* (a public client ID is fine).
- **Never store media binaries in MySQL** — already a stated client requirement; also a real risk if a future engineer, under deadline pressure, base64-encodes an image into a text column for convenience. The `service_images.url`-only pattern should be enforced by the schema (no `BLOB`/`LONGTEXT` media columns) and by API validation (uploads only accepted via the pre-signed-URL flow, §C.20).
- **Direct frontend-to-database access must never be introduced**, even temporarily for a "quick admin panel." All catalog/pricing changes go through the backend API, which is what makes "pricing/catalog must be database-driven, not hardcoded in frontend" actually enforceable and auditable (who changed a price, and when).
- **Role checks must be server-side on every request**, not inferred once at login and cached client-side — a Provider's JWT should never be sufficient, by itself and unchecked, to approve a listing; the backend must re-verify the role claim per request (§C.5).
- **Unapproved listings must never leak through a public catalog endpoint** — the `approved` + `active` filter (§C.9) belongs in the backend query itself, not as a frontend-side hide, since a customer-facing endpoint that returns unapproved data is a data-integrity/trust problem even if the frontend happens not to render it.
- **Secrets Manager access should be least-privilege** — the backend's IAM role should not have broader Secrets Manager, S3, or Cognito admin permissions than the specific handful of secrets/prefixes/actions it uses.

### 37. Cost considerations

- **RDS `db.t4g.micro`** is inexpensive and appropriate for now (§C.21); the main cost risk is not the instance itself but forgetting to right-size before a real traffic spike, or enabling Multi-AZ (which roughly doubles RDS cost) before it's actually needed.
- **Backend compute:** ECS Fargate has an always-on cost proportional to reserved CPU/memory (even at low traffic, unlike Lambda's scale-to-zero) — for a pre-launch/early-launch app with light, unpredictable traffic, this is a real trade-off against Lambda's per-invocation pricing; the recommendation in §C.24 should be weighed against actual expected traffic once that's known, not decided purely on architectural preference.
- **NAT Gateway** (if the backend needs outbound internet access from a private subnet — e.g. to call Cognito's public endpoint or a future payment gateway) has an hourly cost plus per-GB data processing cost that's easy to overlook when planning "just a small backend."
- **S3 + CloudFront:** storage cost is minimal at this catalog's likely scale (product/service photos, not video-heavy); CloudFront adds a small fixed layer of cost but meaningfully reduces S3 request costs and improves customer-facing load times — recommended, but confirm expected media volume before committing.
- **Cognito** has a generous free tier (monthly active users) that very likely covers this project's scale for a long time; not a cost driver at launch.
- **Secrets Manager** charges a small per-secret monthly fee; SSM Parameter Store's standard tier is free and an acceptable substitute if secret rotation automation isn't needed immediately.
- General recommendation: defer any cost commitment (Multi-AZ, NAT Gateway, CloudFront) that isn't required for correctness/security until Phase 2 has a clearer traffic/launch-timeline estimate from the client.

### 38. Deployment architecture (target end state)

```
Customer's browser
      │  HTTPS (handymanservices.in)
      ▼
   Vercel (Next.js frontend)
      │  HTTPS (api.handymanservices.in) — REST calls, Cognito JWT in Authorization header
      ▼
  AWS: ALB (public subnet) ── TLS via ACM
      │
      ▼
  AWS: Backend API compute (private subnet, e.g. ECS Fargate)
      │                                   │
      ▼                                   ▼
  AWS: RDS MySQL (private subnet,   AWS: S3 (media) ── optionally behind CloudFront
       `database-1`, no public access)

  Amazon Cognito: browser ↔ Cognito directly for sign-in/sign-up (Hosted UI or SDK);
  issued JWT is then sent by the browser to the backend API on each request.
```

The frontend never reaches RDS or S3 credentials directly; it reaches Cognito directly only for authentication (which is Cognito's intended integration pattern), and reaches everything else through the backend API.

### 39. Dev/staging/production considerations

Recommend, for Phase 2 to confirm rather than build now: separate Cognito **app clients** (not necessarily separate user pools) per environment so dev/staging test accounts never mix with production users; either a separate, smaller RDS instance for dev/staging or a separate database/schema on request within the same instance (cost-driven choice, not a security requirement, since dev data isn't customer-sensitive); a separate S3 bucket or prefix (`dev/`, `staging/`, `prod/`) for media so a test upload never appears in production; and environment-specific secrets in Secrets Manager/Parameter Store (never sharing a production DB password with a dev environment). Vercel's own preview-deployment domains would need to be included in the backend's CORS allow-list for a staging backend, but not for production.

### 40. Open questions / TBD

Carried forward, unresolved, and not assumed anywhere in this document (source: `PHASE_2_OPEN_QUESTIONS.md`, plus new backend-specific items surfaced here).

**Historical note (added at Phase 3 documentation reconciliation):** items 1, 15, 16, 17, 19, 20, and 21 below were open at the time this Phase 1 document was written. They have since been **resolved by final client decisions** and implemented in Phase 3 — see `PHASE_2_BACKEND_OPEN_QUESTIONS.md` for the current, authoritative status of each. This section's original text is left unchanged below for historical traceability; it no longer reflects the current state of those items.

**Carried from prior phases (unchanged status):**
1. Exact Cognito sign-in method — email+password vs. phone+OTP vs. social.
2. Payment gateway choice/integration and credentials.
3. Exact booking time-slot rules.
4. Coupons (as distinct from `Offer`).
5. Wallet.
6. Refund and cancellation rules.
7. Provider assignment logic (how an order gets matched to a `ServiceProvider`).
8. Live provider tracking.
9. Notifications (email/SMS/push) — and, if SMS/push, which provider (SNS, a third party).
10. Ratings/reviews — whether in scope at all.
11. Exact Service Provider dashboard feature set beyond "create/list listings."
12. Exact Customer account-area feature set (Profile/Addresses/Orders — which are must-have at launch).
13. Final launch cities.
14. Final category/product/service catalogue.
15. Whether guest checkout is allowed at all, or login is required before placing an order (Open Question #17) — this directly determines `Order.customerId` nullability and the cart architecture in §C.16.
16. Multi-city cart behavior (Open Question #24).
17. `Offer` vs. `Service.offerPrice` stacking precedence (Open Question #25).

**New, backend-specific, surfaced by this analysis:**
18. Whether an existing VPC with a usable subnet layout already exists around the current RDS instance, or needs to be designed from scratch for backend compute (§C.22).
19. Final backend compute choice — ECS Fargate (recommended) vs. Lambda vs. another option (§C.24) — needs explicit sign-off before Phase 2 build starts.
20. Whether Admin's scope extends to the existing marketing/content entities (testimonials, FAQs, homepage sections, contact info) or is limited to catalog/pricing/listing-approval only (§C.6).
21. Whether an Admin-authored listing publishes immediately (skips its own approval step) — the only self-consistent reading, but not explicitly stated by the client (§C.9).
22. S3 media access pattern — public-read behind CloudFront vs. signed URLs (§C.20).
23. DNS approach for the API subdomain — GoDaddy CNAME to an ALB vs. delegating the zone to Route 53 (§C.29).
24. RDS Multi-AZ / backup-retention timing — when (not whether) to turn these on, since they are configuration changes explicitly out of scope for this phase (§C.21, §C.27).
25. Dev/staging environment strategy — shared vs. separate RDS/Cognito/S3 per environment (§C.39), and its cost impact.

### 41. Client confirmations still required

To unblock Phase 2 kickoff, the following should be confirmed by the client, roughly in priority order (items that gate the most downstream design first): (1) Cognito sign-in method (email/password, OTP, or both) and whether Admin/Provider require stronger auth (e.g. mandatory MFA) than Customer; (2) is guest checkout allowed, or must a Customer log in before placing an order (this single answer resolves Open Questions #15/#16 above and the cart architecture in §C.16); (3) backend compute choice — confirm or override the ECS Fargate recommendation; (4) Admin's exact scope — catalog/pricing/approvals only, or also the existing marketing content entities; (5) S3 media access pattern (public-read+CDN vs. signed URLs); (6) whether an Admin-created listing requires its own approval step; (7) dev/staging environment strategy and budget tolerance for it; (8) timeline/urgency for RDS Multi-AZ and backup-retention changes (these are configuration changes to the existing instance, deliberately not made in this phase); (9) payment gateway selection and credentials, once available (not a Phase 2 blocker, but should be flagged early given lead time for gateway onboarding/KYC); (10) all previously-open Phase 1/2 business rules that also affect the backend schema directly — multi-city cart behavior, `Offer` stacking precedence, booking slot rules, and provider-assignment logic — since each changes a table's columns or an endpoint's contract, not just UI copy.

---

## D. Proposed Resources (not created in this phase)

Summary list, each cross-referenced to its rationale above — nothing in this section has been created:

- VPC/subnet verification or design for backend compute (§C.22, §C.34).
- Backend compute — ECS Fargate recommended (§C.24, §C.34).
- Application Load Balancer + ACM certificate for `api.handymanservices.in` (§C.28–29, §C.34).
- CloudFront distribution in front of the existing S3 bucket (§C.20, §C.34).
- Secrets Manager (or Parameter Store) entries for DB/Cognito secrets (§C.25, §C.34).
- CloudWatch log groups and alarms (§C.26, §C.34).
- Scoped IAM roles/policies for backend compute (§C.34).
- DNS record for `api.handymanservices.in` in GoDaddy (or a Route 53 delegation) (§C.29, §C.34).
- Cognito Groups/app-client configuration inside the **existing** user pool (§C.4) — configuration of an existing resource, not a new pool.

## E. TBD / Client Confirmation Required

See the consolidated lists in §C.40 (open questions) and §C.41 (confirmations to request) — not duplicated here to avoid drift between two copies of the same list.

## F. Security Considerations

See §C.36 for the full list. Headline principle: RDS stays private and reachable only from backend compute's security group; secrets never reach the frontend; media binaries never enter MySQL; every role check is enforced server-side on every request; unapproved listings are filtered at the query level, not the UI level.

## G. Cost Considerations

See §C.37 for the full breakdown. Headline principle: nothing that adds standing cost (Multi-AZ, NAT Gateway, CloudFront, a large compute reservation) should be turned on ahead of an actual traffic/launch estimate — right-size later, deliberately, rather than over-provision now speculatively.

## H. Phase 2 Prerequisites

Before Phase 2 (actual backend implementation) can begin, the following must be settled:

1. Client confirmations in §C.41, at minimum items (1)–(4) (auth method, guest-checkout decision, compute choice, Admin scope) — these change the schema and endpoint contract, not just implementation detail, so starting Phase 2 without them risks rework.
2. Verification of the existing VPC/subnet layout around the current RDS instance (§C.22, §E.18) — a quick, read-only AWS console/CLI check, not a resource change, and safe to do before any other Phase 2 work.
3. A finalized relational schema derived from §C.31, reviewed against `src/types/index.ts` field-by-field so no existing frontend type is left without a backing column.
4. Sign-off on the recommended architecture diagram (§C.38) or an explicit alternative.
5. Confirmation that this document's explicit non-actions (no EC2, no RDS changes, no security-group changes, no new Cognito pool) remain the boundary for the *start* of Phase 2 as well, or that the client is now ready to authorize the specific resource creation listed in §D.

---

**Stop rule.** This document is the complete Phase 1 deliverable. No backend code has been written, no EC2 instance or other production AWS resource has been created, no RDS configuration has been modified, no security group has been changed, and no existing frontend file has been modified. Work stops here pending client review and the confirmations in §C.41/§H.

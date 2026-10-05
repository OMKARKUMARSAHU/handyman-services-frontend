# Phase 2 — Cognito Architecture & Role/Permission Matrix
## Handyman Services Marketplace

**Status:** Design only. The existing Cognito User Pool is not modified by this document — no group, app client, or attribute is created. This document specifies the target configuration for Phase 3 to apply.

---

## 4. Cognito architecture

### User Pool

**`RECOMMENDED`, confirmed-direction per Phase 1: one Cognito User Pool**, shared by all three roles — not a separate pool per role. The client's own stated requirement ("Admin and Service Provider share one common login entry point; backend determines role") is the single-pool, role-as-group pattern; the brief's own instruction reinforces this ("do not create separate User Pools for each role unless a specific documented requirement makes that necessary" — no such requirement exists in the confirmed scope). This section documents the **final configuration for Phase 3 to apply**, not a change made now.

### User attributes

| Attribute | Standard/custom | Notes |
|---|---|---|
| `email` | Standard | **RESOLVED**: required — sign-in is email+password (see below) |
| `phone_number` | Standard | **RESOLVED**: not required — phone/OTP sign-in is not used; this attribute is not collected at sign-up |
| `name` | Standard | Display name |
| `custom:role` | Custom | `customer` \| `admin` \| `provider` — set at sign-up/creation time; **redundant with, and a fallback for, Cognito Group membership below** — recommended as a belt-and-suspenders attribute since a custom attribute is simpler to read out of a decoded token than resolving group membership in some client libraries, while Groups remain the authoritative mechanism for IAM-style precedence and for AWS-console-side user management |

### Groups (authoritative role mechanism)

Three Cognito Groups: **`customer`**, **`admin`**, **`provider`**. A user is added to exactly one group at account-creation time. Cognito embeds group membership in the issued JWT's `cognito:groups` claim automatically — the backend reads this claim to determine role (§17, System Architecture doc), rather than making a separate lookup call per request.

### App clients

Two app clients within the single pool:

| App client | Used by | Notes |
|---|---|---|
| **Customer app client** | The Customer-specific login entry point on the frontend | Public client (no client secret needed for a browser-based flow) |
| **Admin/Provider app client** | The shared Admin/Provider login entry point | Also public client; the distinction between Admin and Provider happens via the Group claim in the token, not via which app client was used to sign in — both roles use this one shared entry point, matching the client's explicit requirement |

Two app clients (rather than one shared across all three) lets the frontend keep the Customer login screen and the Admin/Provider login screen as genuinely separate UI flows, each pointed at its own client ID, while both still authenticate against the one underlying pool/user directory.

### Customer authentication vs. Admin/Provider authentication

Functionally identical under the hood (both go through Cognito's standard sign-in flow against the same pool) — the difference is purely which app client/UI screen initiates it, and which group the resulting user turns out to belong to. The backend's `/me` endpoint (API Contract doc) returns a role-appropriate shape based on the token's group claim regardless of which entry point was used, which is exactly the "backend determines role after auth" behavior the client asked for.

### Role claim → JWT

On successful sign-in, Cognito issues:

- **ID token**: carries user attributes (`email`, `name`, `custom:role`) — used when the backend needs profile data, not typically sent on every API call.
- **Access token**: carries `cognito:groups` and scopes — this is the token sent as `Authorization: Bearer <accessToken>` on every backend API request (§17, System Architecture doc); the backend's authorization middleware reads the role from this token's `cognito:groups` claim.
- **Refresh token**: used by the frontend to silently renew the access/ID token pair without forcing a re-login; standard Cognito behavior, not a custom design.

### Token validation (backend side)

Exactly as specified in `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §17: signature verified against Cognito's public JWKS (cached, not re-fetched per request), `iss` checked against the pool, `aud`/`client_id` checked against the expected app client for that entry point, `exp` checked for expiry. A token that fails any of these checks is rejected with `401` before any handler logic runs.

### Password reset / email / phone verification

Handled entirely by Cognito's own built-in flows ("forgot password," email/SMS verification codes) — the backend does not implement its own password-reset logic or email-sending for this purpose. This is a direct consequence of using Cognito as the identity provider, not a new design decision.

### MFA recommendation

**`RECOMMENDED`, not confirmed:** optional MFA (SMS or TOTP) for Customer, but **mandatory MFA recommended for Admin and Provider**, given those roles can change pricing, approve listings, and manage customer/provider accounts — a materially higher-consequence blast radius than a Customer's own account. **This is `TBD / CLIENT CONFIRMATION REQUIRED`** — not applied to the existing pool by this document, and not to be assumed as a firm requirement until the client confirms it (raised here as a recommendation because it's a meaningful security posture decision, not because the client asked for it).

### Account status / disabled users

Cognito's own `Enabled`/`Disabled` user state is the source of truth for whether a user can authenticate at all — a disabled Cognito user cannot obtain a new token. The mirrored `account_status` column on `customers`/`service_providers` (Database Schema doc §7) exists only so the backend can make a fast local check without an extra Cognito API call on every request; an Admin action to disable an account (`PATCH /admin/customers/:id` / `/admin/providers/:id`, API Contract doc) must perform **both** the Cognito-side disable **and** the local column update together, not just the local one, so the two never drift out of sync.

### Role assignment

Role is assigned at account-creation time (sign-up flow places the new user into the appropriate Group based on which entry point/flow they signed up through) and is **not** self-service-changeable by the user afterward — only an Admin action (not itself specified as an endpoint here, since "Admin changes a user's role" is not a stated requirement) could move a user between groups, and no such capability is built unless separately confirmed.

### Sign-in method — RESOLVED

**Final client decision:** Customer authentication is **email + password**. Forgot-password uses Cognito's standard email-based forgot-password/reset flow. Admin and Service Provider continue to use the shared Admin/Provider login entry point described above. Phone/OTP and social sign-in are not implemented; the `phone_number` attribute is not required at sign-up.

### Still `TBD / CLIENT CONFIRMATION REQUIRED`

- **MFA requirement**, per role, as discussed above — genuinely still open; not addressed by the Phase 3 Offer/Pricing correction.

---

## 5. Role & permission matrix

Legend: **Own-only** = the caller may act only on resources they themselves created/own (enforced via the ownership check in §17 of the System Architecture doc); **All** = no ownership restriction, any matching resource; **Public** = no authentication required.

### CUSTOMER

| Operation | Required role | Ownership requirement | Validation requirement |
|---|---|---|---|
| Browse catalog (cities/categories/products/services/offers) | Public | — | — |
| Search | Public | — | — |
| View a service detail | Public | — | — |
| View/add/update/remove cart items | Customer (or guest/local — §12, Database doc) | Own-only (if server-persisted) | Quantity > 0 on add/update |
| Checkout (create order) | Customer (**RESOLVED** — guest checkout is disallowed; never Public) | — | Non-empty items, complete address, valid scheduled date (mirrors existing mock validation) |
| View own orders | Customer | Own-only | — |
| View a specific order (confirmation page) | Customer +ownership (**RESOLVED** — guest checkout is disallowed; never Public) | Own-only | — |
| View/update own profile | Customer | Own-only (self) | — |
| View/create/update/delete own addresses | Customer | Own-only | Required fields per `Address` shape |

### SERVICE PROVIDER

| Operation | Required role | Ownership requirement | Validation requirement |
|---|---|---|---|
| View/update own profile | Provider | Own-only (self) | — |
| Create a listing | Provider | — (becomes owner of the new resource) | Required `Service` fields; created as `pending_approval` — never directly publishable |
| Edit own listing | Provider | Own-only | Editing a `rejected` listing re-queues it to `pending_approval` (§9, Database doc); editing an `approved` listing currently re-queues it too (Phase 3's working behavior), but this remains flagged pending explicit client policy confirmation (`PHASE_2_BACKEND_OPEN_QUESTIONS.md` item 27 — API Contract doc note) |
| Submit listing for approval | Provider | Own-only | Implicit in creation/edit — there is no separate "draft" state to submit from (§9) |
| View own listing's approval status | Provider | Own-only | — |
| See rejection reason | Provider | Own-only | Only populated when `approval_status = 'rejected'` |
| View assigned orders | Provider | Own-only (`provider_id` = caller) | **Only if confirmed in scope** — not a firm commitment (API Contract doc note) |

### ADMIN

| Operation | Required role | Ownership requirement | Validation requirement |
|---|---|---|---|
| Manage categories/products/service types/cities | Admin | All | Required fields per entity shape |
| Manage city availability | Admin | All | Valid `serviceId`/`cityId` pair |
| Manage pricing (`mrp`/`offerPrice` on services) | Admin | All | `mrp > 0`, `offerPrice <= mrp` (mirrors existing `computeDiscount` guard) |
| Manage offers | Admin | All | Valid `discountType`/`discountValue`, valid `appliesTo` scope/ids |
| View pending-approval queue | Admin | All | — |
| Approve a listing | Admin | All | Listing must currently be `pending_approval` |
| Reject a listing | Admin | All | Listing must currently be `pending_approval`; `reason` required |
| View/manage all orders | Admin | All | Status transitions constrained to the existing `OrderStatus` lookup |
| View/manage customers | Admin | All | Disable action must sync Cognito + local `account_status` together |
| View/manage providers | Admin | All | Same sync requirement |
| Manage content (FAQs, testimonials, homepage sections, contact info, navigation, branding/logo/brand assets, promotional content) | Admin | All | **RESOLVED** — Admin content-management scope is confirmed as broad (all business/content fields); built in Phase 3 |

**Hard rule, restated from `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §17: every row above is enforced server-side, on every request, never inferred once at login and cached client-side, and never trusted from the frontend's own role-aware UI.**

---

**Cross-reference:** the JWT verification/ownership-check mechanics referenced throughout this matrix are specified in `PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md` §17. The endpoints this matrix governs are listed in `PHASE_2_BACKEND_API_CONTRACT.md`. The `customers`/`service_providers`/`services` columns referenced (`cognito_sub`, `created_by_user_id`, `account_status`, etc.) are defined in `PHASE_2_BACKEND_DATABASE_SCHEMA.md`.

**No Cognito resource is created or modified by this document.**

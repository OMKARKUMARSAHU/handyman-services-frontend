# AUTHENTICATION & AUTHORIZATION PHASE — Final Report

**Status: Complete for the scope below. Strict waterfall followed: INSPECT → PLAN → IMPLEMENT → TEST → DOCUMENT → FINAL REPORT → STOP. No other feature (cart, orders, checkout, payment, S3 upload, catalog, offers, AWS infrastructure deployment) was touched.**

## 1. Scope

Real, working authentication and authorization for all three roles, replacing the previous state where the frontend had no sign-in UI at all and the backend could only verify a token someone else had already issued:

- **Customer**: signup, real Cognito email verification (`CONFIRM_WITH_CODE`), login, forgot/reset password, logout, session handling, protected `/account` routes.
- **Service Provider**: login only (via the shared Admin/Provider entry point), role authorization, a protected `/provider` route.
- **Admin**: login only (via the shared Admin/Provider entry point), role authorization, a protected `/admin` route.
- Exactly three roles throughout (`customer`, `admin`, `provider`) — no Super Admin/Master Admin, anywhere.

## 2. INSPECT findings (recap)

- Frontend had zero authentication: `/login` was a static "not turned on yet" placeholder, no signup/verify/forgot-password pages existed, no Cognito/Amplify dependency, no token storage, no Next.js route guard, and no API client wired to the backend at all (the whole frontend ran on static mock data in `src/lib/data/*`).
- Backend had only token *verification* (`modules/auth/verifier.ts`, `middleware/authenticate.ts`, `requireRole`/`requireOwnership`) — correct and reused as-is — but no endpoint anywhere called Cognito's SignUp/InitiateAuth/ForgotPassword/GlobalSignOut APIs, and no Cognito SDK dependency existed to do so.
- Real Cognito pool (`ap-south-1_EQEjEvk2M`): only one App Client existed (not the two the design reserves env slots for), and **zero Cognito Groups existed** — meaning no token, however valid, could have passed `authenticate()`'s role check before this phase.
- No Provider/Admin account-provisioning workflow is defined anywhere in Phase 1/2/3 documentation or code — confirmed by inspection, not assumed. Per your explicit instruction, this was flagged and **not guessed at**: Provider/Admin accounts are provisioned out-of-band by an operator (today: directly in Cognito by whoever runs this project), not through a self-service flow this phase builds.

## 3. Decisions you approved

1. Create the 3 Cognito Groups (`customer`, `provider`, `admin`) in the existing pool.
2. Create a second, confidential (client-secret) App Client for the shared Admin/Provider login; leave the existing Customer App Client untouched.
3. Backend-proxied Cognito architecture: the backend calls Cognito directly (SignUp/ConfirmSignUp/InitiateAuth/ForgotPassword/ConfirmForgotPassword/GlobalSignOut); the frontend never receives AWS credentials; no `localStorage`; HttpOnly cookies for session.
4. Customer self-signup assigns the `customer` group itself, server-side, right after `ConfirmSignUp` succeeds (Option B — no Lambda trigger).
5. No Provider/Admin signup endpoint; two real test accounts created for manual QA (see `MANUAL_TEST_ACCOUNTS.md`, not repeated here).
6. Credential split: this sandbox's backend has no real AWS credentials, so Cognito API calls are exercised in automated tests against a realistic in-memory fake; the real pool/Groups/app client/test users were created and verified directly via the AWS MCP connector, separately.

## 4. Real AWS/Cognito changes made (and NOT made)

All via the AWS MCP connector, account `129741467723`, region `ap-south-1`. Full detail (resource IDs, the new client's secret, test account passwords) is in `MANUAL_TEST_ACCOUNTS.md`, kept out of this report and out of chat.

**Made:**
- 3 Cognito Groups created in `ap-south-1_EQEjEvk2M`: `customer`, `provider`, `admin`.
- 1 new App Client created ("Handyman Services Admin-Provider backend") — confidential (has a secret), `ALLOW_USER_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`, `PreventUserExistenceErrors: ENABLED`, no OAuth/Hosted-UI config (not needed — backend-only).
- 2 test users created (`AdminCreateUser` + `AdminSetUserPassword` + `AdminAddUserToGroup`), one in `provider`, one in `admin` — both `CONFIRMED`.

**Explicitly not done:** the existing User Pool was not deleted or recreated; the existing Customer App Client (`1k0cuqjjs55bo6egeb017nmpg3`) was not modified in any way; no Lambda trigger was created; no existing user was modified or deleted; no RDS/S3/ECS/ALB/IAM resource was touched.

## 5. Backend implementation

New files under `backend/src/modules/auth/`: `cognito.client.ts` (lazy SDK client singleton, same pattern as the existing S3 client and JWT verifier — swappable for tests), `secretHash.ts` (Cognito's `SECRET_HASH` computation for the confidential Admin/Provider client only), `cognito.service.ts` (all the real Cognito calls + error mapping), `auth.schema.ts` (zod validation mirroring the real pool's password policy), `cookies.ts` (HttpOnly cookie helpers), `auth.routes.ts` (the new `/auth/*` endpoints).

Endpoints added, all under `/api/v1`:

| Method | Path | Role |
|---|---|---|
| POST | `/auth/signup` | public (customer) |
| POST | `/auth/confirm-signup` | public (customer) |
| POST | `/auth/resend-code` | public (customer) |
| POST | `/auth/login` | public (customer) |
| POST | `/auth/admin-provider/login` | public (shared entry point — role decided by the token, not by which function was called) |
| POST | `/auth/forgot-password` | public (customer) |
| POST | `/auth/confirm-forgot-password` | public (customer) |
| POST | `/auth/logout` | any authenticated session |

Login flow note: the existing Customer App Client only has `ALLOW_USER_AUTH`/`ALLOW_USER_SRP_AUTH`/`ALLOW_REFRESH_TOKEN_AUTH` enabled (verified directly against the real pool) — not the simpler `ALLOW_USER_PASSWORD_AUTH` — so login uses Cognito's `USER_AUTH` flow (`InitiateAuth` → `PASSWORD` challenge → `RespondToAuthChallenge`) rather than inventing a flow the real client doesn't support. The new Admin/Provider client was deliberately created with the same flow so one code path serves both.

Session: `POST /auth/login` and `/auth/admin-provider/login` set three HttpOnly, `sameSite: "lax"` cookies (`hs_at` the access token, `hs_rt` the refresh token, `hs_client` which app client issued them) — never readable from frontend JS, never `localStorage`. `authenticate()` (unchanged logic otherwise) now accepts a token from the `Authorization: Bearer` header **or** falls back to the `hs_at` cookie — every existing route's role/ownership enforcement is unchanged.

Not built (flagged, not silently skipped): a `/auth/refresh` endpoint. The refresh token is stored in a cookie today but nothing consumes it yet — a session simply ends when the ~60-minute access token expires. Building token refresh wasn't explicitly requested and would add real scope; it's a natural next step, not a bug.

## 6. Frontend implementation

New: `src/lib/auth/api.ts` (fetch wrapper, always `credentials: "include"`), `src/lib/auth/types.ts`, `src/lib/state/AuthProvider.tsx` (site-wide "who's signed in" context, backed by `GET /me`), `src/proxy.ts` (Next.js 16 renamed `middleware.js` to `proxy.js` — this phase used the current convention, not the deprecated one).

New pages: `/signup`, `/verify`, `/forgot-password`, `/reset-password`, `/staff/login` (the one shared Admin/Provider entry point). `/login` was rewritten from its old placeholder into a real form. `/account` now shows a genuinely signed-in customer's real identity and a real logout instead of always claiming "not logged in." `/account/orders` and `/account/addresses` still don't do anything (out of scope) but no longer lie to a signed-in customer about being logged out.

`/provider` and `/admin` are new, real, protected routes — but deliberately honest placeholders (matching this project's established pattern, see `AccountPreAuth.tsx`): they show the real signed-in identity and a working logout, and say plainly that listing/order/content management screens aren't built yet, because building them is out of this phase's scope.

`src/proxy.ts` redirects an unauthenticated/wrong-role browser away from `/account`, `/provider`, `/admin` for UX — it only decodes the token's claims, it does **not** verify the signature. This is explicitly not the security boundary; it never was going to be. The real enforcement is, and remains, the backend's `authenticate()` (full Cognito JWKS signature/issuer/audience/expiry verification) and `requireRole()`/`requireOwnership()` on every request, unchanged by this phase's frontend work.

## 7. Testing

**Backend:** 18 new tests in `tests/modules/auth-flows.test.ts`, all passing alongside the 90 pre-existing tests (108/108 total). `npm run typecheck`, `npm run lint`, and `npm run build` all pass clean.

What's real vs. faked, exactly: `tests/helpers/fakeCognitoClient.ts` is a genuine in-memory state machine (not a trivial stub) for the Cognito API calls this backend makes — it enforces the same rules the real pool does (an unconfirmed user can't log in, a wrong code/password is rejected, `AdminAddUserToGroup` is what actually puts a user in a group). On a successful login it mints a **real, independently RS256-signed JWT** using the exact same test keypair/JWKS the pre-existing `cognitoTestKit.ts` installs as the app's verifier — so every test that then calls a protected route (`GET /customer/me`, `GET /provider/me`, `GET /admin/listings/pending`) is exercising the REAL `authenticate()`/`requireRole()` pipeline end-to-end, with real signature verification, not a bypass. Only the Cognito *API* call itself (SignUp, InitiateAuth, etc.) is faked — necessarily, since this sandbox's backend has no real AWS credentials (the approved credential split). The real pool's new Groups/app client/test users were separately verified directly against AWS via the MCP connector (§4).

Covered: customer signup, duplicate signup, wrong verification code, login before confirmation, successful confirm→group-assignment→login→protected-route, wrong password, unknown email (no existence leak), resend code, forgot-password (including the generic response for an unknown email), full reset-password round trip, wrong reset code, provider login reaching a provider-only route, admin login reaching an admin-only route, a provider's session correctly blocked from an admin-only route, confirming no Provider/Admin signup endpoint exists, logout clearing cookies, and rejecting logout with no session. Unauthenticated/expired/invalid-token and wrong-role cases for the *existing* verification layer were already covered by `tests/modules/auth.test.ts` and `authorization.test.ts` (untouched, still passing).

**Frontend:** `npm run build` (includes a full TypeScript check and static-page generation across all ~500 routes) and `npm run lint` both pass clean. Two pre-existing repo-hygiene gaps were fixed as part of getting a true build/lint signal, not invented busywork: the root `tsconfig.json`/`eslint.config.mjs` had no exclude for the sibling `backend/` project, so `next build`/`eslint` were accidentally trying to type-check and lint backend source and compiled output as if it were part of the Next.js app. Both now explicitly exclude `backend/` (which keeps its own independent `npm run typecheck`/`lint`, verified separately, unaffected).

No automated frontend test runner exists in this repo (confirmed — no `jest`/`vitest`/`playwright` config or scripts); frontend "testing" here is the build/lint signal above plus the backend's real integration coverage of every endpoint the frontend calls.

## 8. What this phase explicitly did NOT build

- A Provider/Admin self-service signup, invite, or account-request flow — the provisioning workflow itself remains an open business decision (§2), not guessed at.
- A `/auth/refresh` endpoint (session simply ends at the ~60-minute access-token expiry today).
- Real functional Provider/Admin panels (listing/order/content management) — `/provider` and `/admin` are honest, auth-gated placeholders only.
- Any change to cart, checkout, orders, payment, S3/media, catalog, offers, DNS, or AWS infrastructure deployment (Phase 4 remains paused exactly where it was).
- Stricter, auth-specific rate limiting beyond the existing global limiter — worth hardening before production, not done here.

## 9. Confirmation

- Exactly three roles exist, enforced server-side from the verified token's group claim only — no Super Admin/Master Admin was created anywhere, frontend included.
- No password is ever stored in the application database; Cognito remains the sole credential store.
- No Cognito secret or AWS credential is exposed to the frontend — the new Admin/Provider client's secret lives only in backend configuration (`MANUAL_TEST_ACCOUNTS.md` for now, pending real deployment/Secrets Manager).
- The two real Cognito configuration changes required (new Groups, new App Client) were reported and approved before being made (§3), exactly as instructed — no change was made silently.
- All real AWS actions were additive (new groups, a new app client, two new test users); nothing existing was modified, deleted, or recreated.

**This phase is complete. Per your instruction, no other feature is started from here — stopping and awaiting your next direction.**

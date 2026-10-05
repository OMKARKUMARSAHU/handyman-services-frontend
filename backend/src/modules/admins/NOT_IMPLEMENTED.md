# `admins` module — intentionally empty

There is no dedicated `admins` database table and no `admins` router in this
codebase. This is a deliberate design decision, not an oversight:

- The Phase 3 brief is explicit and final: exactly three roles exist
  (`CUSTOMER`, `ADMIN`, `SERVICE_PROVIDER`) with **no fourth "Super Admin"
  role, ever**, and Admin identity comes entirely from Cognito (the
  `admin` group in the shared User Pool). There is nothing Admin-specific
  to persist locally the way `customers` and `service_providers` persist a
  just-in-time local profile row for their respective roles.
- Every `/admin/*` route needed by the API contract already lives in the
  module it actually operates on (`/admin/services`, `/admin/customers`,
  `/admin/providers`, `/admin/orders`, `/admin/offers`, `/admin/faqs`,
  `/admin/branding`, etc.) — see `src/routes/index.ts` for the full list.
- The generic, role-aware `GET /me` (`src/modules/users/users.routes.ts`)
  returns an Admin's profile shape straight from their verified token
  claims (`sub`, `name`, `email`), since there is no database row to read.

See `PHASE_3_BACKEND_IMPLEMENTATION.md` §2 (project structure) and §17
(remaining limitations) for the full rationale.

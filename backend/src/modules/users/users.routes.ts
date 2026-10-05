import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { ok } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { findOrCreateCustomerBySub } from "../customers/customers.service";
import { findOrCreateServiceProviderBySub } from "../providers/providers.service";

/**
 * Generic, role-aware `/me` (PHASE_2_BACKEND_API_CONTRACT.md §AUTH: "Any
 * authenticated" → each role's own shape — replaces the reserved mock
 * `getCurrentCustomer()`). This sits alongside, not instead of, the
 * role-specific `/customer/me` and `/provider/me` routes those modules
 * already expose; those stay the canonical per-role profile endpoints, this
 * is the one a generic "who am I" caller can hit without first knowing the
 * caller's role.
 *
 * Admin has no backing table (no dedicated `admins` table exists — Admin
 * identity is Cognito-group-only, per the finalized 3-role design), so its
 * shape is derived straight from the verified token claims rather than a
 * database row.
 */
export function usersRouter(): Router {
  const router = Router();

  router.get(
    "/me",
    authenticate(),
    asyncHandler(async (req, res) => {
      const { role, sub, claims } = req.auth!;

      if (role === "customer") {
        ok(res, { role, ...(await findOrCreateCustomerBySub(sub, claims)) });
        return;
      }
      if (role === "provider") {
        ok(res, { role, ...(await findOrCreateServiceProviderBySub(sub, claims)) });
        return;
      }
      // role === "admin"
      ok(res, {
        role,
        sub,
        name: typeof claims.name === "string" ? claims.name : "Admin",
        email: typeof claims.email === "string" ? claims.email : null,
      });
    })
  );

  return router;
}

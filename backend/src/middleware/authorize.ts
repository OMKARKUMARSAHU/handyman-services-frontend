import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Role } from "../modules/auth/roles";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "../shared/errors";

/**
 * Step 5 of the authorization pipeline (PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §17):
 * declarative role requirement. Must run after `authenticate()`.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthenticatedError());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError(`This action requires one of these roles: ${roles.join(", ")}.`));
      return;
    }
    next();
  };
}

/**
 * Step 4 of the authorization pipeline: resource ownership. `resolveOwnerSub`
 * looks up the resource and returns the Cognito `sub` of whoever owns it
 * (e.g. the order's customer's cognito_sub, or the listing's
 * created_by_user_id when the creator is the caller's own provider row).
 *
 * - Returns a sub string that matches `req.auth.sub` → allowed.
 * - Returns a sub string that does NOT match → 403 (a valid, authenticated
 *   caller, just not this resource's owner).
 * - Returns `null` (resource doesn't exist) → 404, so a non-owner can't use
 *   this check to learn whether a resource exists at all
 *   (PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §17's own "or 404" allowance).
 *
 * A valid, correctly-authenticated token for one user must never be
 * sufficient by itself to act on another user's resource — this is the
 * check that enforces that, on every route that needs it.
 */
export function requireOwnership(
  resolveOwnerSub: (req: Request) => Promise<string | null>
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      next(new UnauthenticatedError());
      return;
    }
    try {
      const ownerSub = await resolveOwnerSub(req);
      if (ownerSub === null) {
        next(new NotFoundError());
        return;
      }
      if (ownerSub !== req.auth.sub) {
        next(new ForbiddenError("You do not own this resource."));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

import type { NextFunction, Request, Response } from "express";
import { getVerifier } from "../modules/auth/verifier";
import { isRole } from "../modules/auth/roles";
import { ForbiddenError, UnauthenticatedError } from "../shared/errors";
import type { AuthenticatedUser } from "../modules/auth/types";
import { readAccessTokenCookie } from "../modules/auth/cookies";

/**
 * Step 1–3 of the authorization pipeline (PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §17):
 * JWT verification → user identity → role. Ownership/permission checks
 * (steps 4–5) are separate middleware (authorize.ts) applied per-route, so
 * a route can compose exactly the checks it needs.
 *
 * Never trusts anything the frontend claims about who the caller is or
 * what role they have — the only inputs here are the bearer token and the
 * Cognito-issued, signature-verified claims inside it.
 *
 * Token source (AUTHENTICATION & AUTHORIZATION PHASE): an `Authorization:
 * Bearer <token>` header is checked first (what every existing test and any
 * non-browser API caller uses), falling back to the `hs_at` HttpOnly cookie
 * set by `POST /auth/login` / `/auth/admin-provider/login` — this is how the
 * frontend stays authenticated without ever holding the token in JS-readable
 * storage. Neither path changes what happens after a token is found: the
 * same verification and role extraction below applies either way.
 */
export function authenticate() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.header("authorization") ?? req.header("Authorization");
    const headerToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
    const token = headerToken || readAccessTokenCookie(req.cookies as Record<string, string> | undefined);

    if (!token) {
      next(new UnauthenticatedError("An Authorization: Bearer <token> header or session cookie is required."));
      return;
    }

    try {
      const payload = await getVerifier().verify(token);
      const groups = Array.isArray(payload["cognito:groups"]) ? (payload["cognito:groups"] as unknown[]) : [];
      const role = groups.find(isRole);

      if (!role) {
        next(new ForbiddenError("This account is not assigned to a recognized role (customer/admin/provider)."));
        return;
      }

      const user: AuthenticatedUser = {
        sub: String(payload.sub),
        role,
        claims: payload as Record<string, unknown>,
      };
      req.auth = user;
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token verification failed.";
      next(new UnauthenticatedError(`Invalid or expired token: ${message}`));
    }
  };
}

/**
 * Like `authenticate()`, but never rejects a request for missing/invalid
 * credentials — it just leaves `req.auth` unset. Used only where a route's
 * behavior legitimately differs for guests vs. signed-in users without the
 * whole route requiring auth (none of the current endpoints need this, but
 * kept available rather than duplicating the token-parsing logic if one
 * does later).
 */
export function optionalAuthenticate() {
  const required = authenticate();
  return (req: Request, res: Response, next: NextFunction): void => {
    required(req, res, (err?: unknown) => {
      if (err) {
        req.auth = undefined;
      }
      next();
    });
  };
}

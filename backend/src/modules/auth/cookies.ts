import type { Response } from "express";
import { isProduction } from "../../config/env";

/**
 * Session token storage (AUTHENTICATION & AUTHORIZATION PHASE brief —
 * "prefer secure HttpOnly cookies ... do not store tokens in localStorage").
 * Three small, non-sensitive-besides-the-tokens-themselves cookies:
 *
 * - `hs_at` — the Cognito ACCESS token. Read by `authenticate()` on every
 *   API request (falls back to it when no `Authorization` header is sent).
 * - `hs_rt` — the Cognito REFRESH token. Not read by any route in this
 *   phase (no refresh endpoint is built yet — see the final report's
 *   "explicitly not built" list); stored now so a future refresh endpoint
 *   doesn't require a second login-flow change.
 * - `hs_client` — which app client ("customer" | "adminProvider") issued
 *   the tokens. Not itself sensitive; needed by a future refresh endpoint
 *   to know which app client (and secret, for adminProvider) to replay
 *   REFRESH_TOKEN_AUTH against.
 *
 * All three are `httpOnly` (never readable by frontend JavaScript) and
 * `secure` in production. `sameSite: "lax"` allows the cookie on a normal
 * top-level navigation/same-site fetch while still blocking cross-site
 * form-style requests — appropriate for a first-party frontend calling its
 * own backend with `credentials: "include"`.
 */
export type AuthClientType = "customer" | "adminProvider";

const ACCESS_COOKIE = "hs_at";
const REFRESH_COOKIE = "hs_rt";
const CLIENT_COOKIE = "hs_client";

const BASE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};

export function setAuthCookies(
  res: Response,
  params: { accessToken: string; refreshToken?: string; accessTokenExpiresInSeconds: number; clientType: AuthClientType }
): void {
  res.cookie(ACCESS_COOKIE, params.accessToken, {
    ...BASE_OPTIONS,
    maxAge: params.accessTokenExpiresInSeconds * 1000,
  });
  res.cookie(CLIENT_COOKIE, params.clientType, {
    ...BASE_OPTIONS,
    // Kept alongside the refresh token's lifetime, not the (short) access token's.
    maxAge: 5 * 24 * 60 * 60 * 1000,
  });
  if (params.refreshToken) {
    res.cookie(REFRESH_COOKIE, params.refreshToken, {
      ...BASE_OPTIONS,
      maxAge: 5 * 24 * 60 * 60 * 1000,
    });
  }
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, BASE_OPTIONS);
  res.clearCookie(REFRESH_COOKIE, BASE_OPTIONS);
  res.clearCookie(CLIENT_COOKIE, BASE_OPTIONS);
}

export function readAccessTokenCookie(cookies: Record<string, string> | undefined): string | undefined {
  return cookies?.[ACCESS_COOKIE];
}

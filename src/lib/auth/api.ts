import type { ApiErrorBody, CurrentUser } from "./types";

/**
 * Thin fetch wrapper for the auth endpoints the backend exposes under
 * `/auth/*` (see backend/src/modules/auth/auth.routes.ts) plus the existing
 * role-aware `GET /me`. `credentials: "include"` is the whole point — the
 * backend sets the session as HttpOnly cookies (`hs_at`/`hs_rt`/`hs_client`),
 * never readable from this code, so every call here must send/receive
 * cookies for the session to work at all.
 *
 * PHASE R: this used to fetch `NEXT_PUBLIC_API_BASE_URL` directly from
 * every caller, which works locally but can never work in the browser
 * against the production EB backend (no working HTTPS/443 there yet) --
 * see `@/lib/server/backend-url` for why `request()` below now branches
 * on where this code is actually running.
 */
import { BROWSER_PROXY_BASE_PATH, DIRECT_BACKEND_BASE_URL, isBrowserRuntime } from "@/lib/server/backend-url";

export class AuthApiError extends Error {
  readonly code: string;
  readonly status: number;
  // MEDIA LIBRARY FOLLOW-UP: the backend's error envelope has always carried
  // an optional `details` field (see ApiErrorBody in ./types) -- it was just
  // never surfaced here. Optional, additive: every existing call site that
  // constructs or catches an AuthApiError is unaffected. The Media Library's
  // "this item is still in use" 409 is the first consumer, carrying a
  // structured reference list instead of just a message string.
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // PHASE R: in the browser, go through the same-origin proxy
  // (`src/app/api/backend/[...path]/route.ts`) instead of the backend
  // origin directly -- server-side (SSR) callers still dial it directly,
  // since that hop is not a browser and has no mixed-content/TLS-trust
  // restriction. See `@/lib/server/backend-url`.
  const base = isBrowserRuntime() ? BROWSER_PROXY_BASE_PATH : DIRECT_BACKEND_BASE_URL;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    // MEDIA LIBRARY FOLLOW-UP: the request never reached a server at all --
    // distinguish this from a parsed backend error so the UI doesn't just
    // show the browser's bare "Failed to fetch".
    throw new AuthApiError(
      0,
      "NETWORK_ERROR",
      `Could not reach the server at ${base}. Check that the backend is running and reachable.`
    );
  }

  const body = (await res.json().catch(() => null)) as (ApiErrorBody & { data?: T }) | null;

  if (!res.ok || !body || body.success === false) {
    const message = body && "error" in body ? body.error.message : "Something went wrong. Please try again.";
    const code = body && "error" in body ? body.error.code : "UNKNOWN_ERROR";
    const details = body && "error" in body ? body.error.details : undefined;
    throw new AuthApiError(res.status, code, message, details);
  }

  return (body as unknown as { data: T }).data;
}

function post<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(payload) });
}

/** Exported so admin-only API modules (e.g. `@/lib/admin/api`) can reuse the same cookie-based request wrapper rather than duplicating it. */
export function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init);
}

export function signup(input: { name: string; email: string; password: string }) {
  return post<{ email: string; confirmed: boolean }>("/auth/signup", input);
}

export function confirmSignup(input: { email: string; code: string }) {
  return post<{ email: string; confirmed: boolean }>("/auth/confirm-signup", input);
}

export function resendCode(input: { email: string }) {
  return post<{ email: string; resent: boolean }>("/auth/resend-code", input);
}

export function login(input: { email: string; password: string }) {
  return post<{ email: string }>("/auth/login", input);
}

/**
 * An Admin/Provider account created via Cognito AdminCreateUser starts with a
 * temporary password (Cognito status FORCE_CHANGE_PASSWORD). A correct temporary
 * password resolves here as `{ challenge: "NEW_PASSWORD_REQUIRED", session }` —
 * no session cookie is set yet — rather than as a success or as a thrown
 * AuthApiError, since it is neither: the caller must call
 * `completeAdminProviderNewPassword()` with that `session` before a real session
 * exists. See backend/src/modules/auth/cognito.service.ts for why.
 */
export function adminProviderLogin(input: { email: string; password: string }) {
  return post<{ email: string } | { email: string; challenge: "NEW_PASSWORD_REQUIRED"; session: string }>(
    "/auth/admin-provider/login",
    input
  );
}

/** Completes an in-progress NEW_PASSWORD_REQUIRED challenge from `adminProviderLogin()`. On success this sets the real session cookies, exactly like a normal login. */
export function completeAdminProviderNewPassword(input: { email: string; session: string; newPassword: string }) {
  return post<{ email: string }>("/auth/admin-provider/complete-new-password", input);
}

export function forgotPassword(input: { email: string }) {
  return post<{ email: string; codeSent: boolean }>("/auth/forgot-password", input);
}

export function confirmForgotPassword(input: { email: string; code: string; newPassword: string }) {
  return post<{ email: string; reset: boolean }>("/auth/confirm-forgot-password", input);
}

// ---- Service Provider self-registration (FINAL AUTHENTICATION ARCHITECTURE §5) ----

export interface ProviderSignupInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  businessName?: string;
  city: string;
  categories: string[];
  yearsExperience?: number;
  bio?: string;
  availability?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

export function providerSignup(input: ProviderSignupInput) {
  return post<{ email: string; confirmed: boolean }>("/auth/provider/signup", input);
}

export function confirmProviderSignup(input: { email: string; code: string }) {
  return post<{ email: string; confirmed: boolean }>("/auth/provider/confirm-signup", input);
}

export function resendProviderCode(input: { email: string }) {
  return post<{ email: string; resent: boolean }>("/auth/provider/resend-code", input);
}

// ---- Shared Admin/Provider ("staff") forgot-password (FINAL AUTHENTICATION ARCHITECTURE §8) ----

export function staffForgotPassword(input: { email: string }) {
  return post<{ email: string; codeSent: boolean }>("/auth/admin-provider/forgot-password", input);
}

export function staffConfirmForgotPassword(input: { email: string; code: string; newPassword: string }) {
  return post<{ email: string; reset: boolean }>("/auth/admin-provider/confirm-forgot-password", input);
}

export async function logout(): Promise<void> {
  await post<{ loggedOut: boolean }>("/auth/logout", {});
}

/** Returns the signed-in user, or `null` if there is no session (never throws for that case). */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await request<CurrentUser>("/me", { method: "GET" });
  } catch (err) {
    if (err instanceof AuthApiError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  }
}

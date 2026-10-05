"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CurrentUser } from "@/lib/auth/types";
import { fetchCurrentUser, logout as apiLogout, AuthApiError } from "@/lib/auth/api";

/**
 * Site-wide "who is signed in" state (AUTHENTICATION & AUTHORIZATION PHASE).
 * The session itself lives in HttpOnly cookies the backend set — this
 * provider never reads or stores a token; it only asks the backend `GET /me`
 * who that cookie belongs to. `status === "loading"` covers the one
 * unavoidable round trip on first mount so pages can avoid flashing a
 * "logged out" state before that check completes.
 *
 * ROLE-ROUTING FIX (login -> /me -> role -> dashboard was inconsistent):
 * `refresh()` used to let ANY `GET /me` failure (a transient network blip,
 * the backend restarting under `tsx watch`, a cold Cognito JWKS fetch right
 * after the backend starts) propagate as a thrown rejection. Two call sites
 * awaited it with no `catch` (this file's own mount effect, and
 * `StaffLoginForm.finishSignIn()`), so a single bad `/me` call left
 * `status` stuck at `"loading"` forever — the exact "dashboard doesn't
 * open" symptom, and it only showed up intermittently because it only
 * happened when that one `/me` call happened to fail. `fetchCurrentUser()`
 * already turns a real 401/403 ("not logged in") into `null` — a non-auth
 * failure is a DIFFERENT thing and must never be treated as "logged out"
 * (that would also incorrectly clear a perfectly valid session) and must
 * never hang the UI. `refresh()` now (a) always reaches `status: "ready"`,
 * (b) retries exactly once on a non-auth failure before giving up (a
 * backend restart / JWKS cold-start is typically gone within one retry),
 * (c) on repeated failure leaves `user` as whatever it already was instead
 * of wiping a valid session (tracked via a ref so this reads the LATEST
 * value, not a value captured in a stale closure), and (d) returns the
 * resolved user so callers (StaffLoginForm) can redirect off this ONE
 * `/me` call instead of making their own second, redundant, unprotected
 * `fetchCurrentUser()` call.
 */
interface AuthContextValue {
  user: CurrentUser | null;
  status: "loading" | "ready";
  /** Re-fetches `GET /me` — call after a successful login so the rest of the app learns about the new session immediately. Resolves with the fetched user (or `null`) so a caller can make a role-based redirect decision off this same call instead of fetching `/me` again. */
  refresh: () => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  // Mirrors `user` so `refresh()`'s retry/fallback branch always reads the
  // latest value — a plain closure over `user` inside a `useCallback([])`
  // would otherwise be frozen at whatever `user` was on the render that
  // first created the callback.
  const userRef = useRef<CurrentUser | null>(null);
  const setUserAndRef = useCallback((next: CurrentUser | null) => {
    userRef.current = next;
    setUser(next);
  }, []);

  const refresh = useCallback(async (): Promise<CurrentUser | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const current = await fetchCurrentUser();
        setUserAndRef(current);
        setStatus("ready");
        return current;
      } catch (err) {
        // A real 401/403 already resolves to `null` inside fetchCurrentUser()
        // and never reaches this catch — so landing here means something
        // OTHER than "not logged in" went wrong (network error, backend
        // restart, a cold Cognito JWKS fetch). Retry once before giving up.
        if (attempt === 0) {
          await sleep(400);
          continue;
        }
        // Still failing on the retry: never let this hang the UI on
        // "Checking your session…" forever, and never silently log out a
        // session that might still be perfectly valid — report "we don't
        // know yet" by keeping whatever `user` already was.
        if (!(err instanceof AuthApiError)) {
          // eslint-disable-next-line no-console
          console.warn("GET /me failed after retry; keeping existing session state.", err);
        }
        setStatus("ready");
        return userRef.current;
      }
    }
    return userRef.current;
  }, [setUserAndRef]);

  useEffect(() => {
    // One-time session check on mount (same justified pattern as
    // CartProvider's one-time localStorage hydration effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUserAndRef(null);
    }
  }, [setUserAndRef]);

  return <AuthContext.Provider value={{ user, status, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used within <AuthProvider>.");
  return ctx;
}

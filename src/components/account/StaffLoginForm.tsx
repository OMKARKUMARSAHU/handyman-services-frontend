"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/lib/state/AuthProvider";
import { adminProviderLogin, completeAdminProviderNewPassword, AuthApiError } from "@/lib/auth/api";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";

/**
 * The ONE shared Admin/Service Provider sign-in entry point (FINAL
 * AUTHENTICATION ARCHITECTURE §2: "Admin and Service Provider must use ONE
 * shared staff login entry point ... after successful authentication, the
 * backend/Cognito role decides where the user goes"). There is deliberately
 * no Admin signup anywhere on this page (§3/§14 — Admin accounts are
 * operator-provisioned only); the one signup link here is explicitly
 * labeled for Service Provider only.
 *
 * Role-based redirect is entirely driven by the verified `GET /me` response
 * in `finishSignIn()` — never by anything selected in this form. A pending
 * or rejected provider is still sent to `/provider`; that page itself (not
 * this form) decides whether to render the real dashboard or a status
 * screen, based on `approvalStatus` from the same `/me` call.
 */
export function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set only when the backend reports a Cognito NEW_PASSWORD_REQUIRED challenge — an
  // AdminCreateUser-provisioned Admin/Provider account's first sign-in with its temporary
  // password. No session cookie exists yet at that point; `session` must be replayed back
  // via completeAdminProviderNewPassword() to finish the challenge and obtain one.
  const [newPasswordSession, setNewPasswordSession] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  async function finishSignIn() {
    // The backend never tells the frontend "which" role to send you to at login time —
    // role comes only from the verified token's own group claim, read back here via /me.
    // Never trust a role supplied by the frontend (FINAL AUTHENTICATION ARCHITECTURE §10).
    // `refresh()` is the ONE `/me` call: it both updates the shared AuthProvider state
    // AND returns the fetched user, so this no longer makes its own second, redundant
    // `fetchCurrentUser()` call (that second call previously raced the first and, being
    // unprotected, could throw on a transient failure and show "Something went wrong"
    // even though the login itself had already succeeded).
    const me = await refresh();
    const next = searchParams.get("next");
    if (me?.role === "admin") router.push(next && next.startsWith("/admin") ? next : "/admin");
    else if (me?.role === "provider") router.push(next && next.startsWith("/provider") ? next : "/provider");
    else router.push("/");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const result = await adminProviderLogin({ email, password });
      if ("challenge" in result && result.challenge === "NEW_PASSWORD_REQUIRED") {
        setNewPasswordSession(result.session);
        setStatus("idle");
        return;
      }
      await finishSignIn();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof AuthApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setStatus("error");
      setErrorMessage("Passwords do not match.");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await completeAdminProviderNewPassword({ email, session: newPasswordSession!, newPassword });
      await finishSignIn();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof AuthApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (newPasswordSession) {
    return (
      <Container className="max-w-md">
        <form onSubmit={handleSetNewPassword} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-neutral-600">
            This account needs a new password before you can sign in for the first time.
          </p>
          <div>
            <label htmlFor="newPassword" className={labelClasses}>
              New password *
            </label>
            <PasswordInput id="newPassword" required autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
          </div>
          <div>
            <label htmlFor="confirmNewPassword" className={labelClasses}>
              Confirm new password *
            </label>
            <PasswordInput
              id="confirmNewPassword"
              required
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
            />
          </div>

          {status === "error" && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {errorMessage}
            </p>
          )}

          <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full">
            {status === "submitting" ? "Setting password…" : "Set password and sign in"}
          </Button>
        </form>
      </Container>
    );
  }

  return (
    <Container className="max-w-md">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white">
            <Icon name="shield-check" className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">Staff Portal</p>
            <p className="text-xs text-neutral-500">Admin and Service Provider sign-in</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className={labelClasses}>
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className={inputClasses}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className={labelClasses}>
                Password *
              </label>
              <Link href="/staff/forgot-password" className="mb-1.5 text-xs font-medium text-brand-700 hover:underline">
                Forgot Password?
              </Link>
            </div>
            <PasswordInput id="password" required autoComplete="current-password" value={password} onChange={setPassword} />
          </div>

          {status === "error" && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {errorMessage}
            </p>
          )}

          <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full">
            {status === "submitting" ? "Signing in…" : "Log in"}
          </Button>
        </form>

        <div className="mt-6 space-y-2 border-t border-neutral-100 pt-5 text-center">
          <p className="text-sm text-neutral-600">
            New Service Provider?{" "}
            <Link href="/staff/provider/signup" className="font-medium text-brand-700 hover:underline">
              Create Service Provider Account
            </Link>
          </p>
          <p className="text-xs text-neutral-500">
            Customer?{" "}
            <Link href="/login" className="font-medium text-neutral-700 hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </Container>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/lib/state/AuthProvider";
import { login, AuthApiError } from "@/lib/auth/api";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";

/**
 * Real customer login (AUTHENTICATION & AUTHORIZATION PHASE) — replaces the
 * previous honest "sign-in isn't turned on yet" placeholder now that it is.
 * Guest browsing/add-to-cart is unaffected: nothing here forces a login
 * except visiting this page or an `/account` page directly.
 *
 * FINAL AUTHENTICATION ARCHITECTURE §10: `next` is only ever honored when
 * it points back into the customer's own area — a crafted
 * `/login?next=/admin` must never be able to steer a customer's post-login
 * redirect at a staff route (the backend/proxy still block the destination
 * either way, but this closes the sloppy redirect itself, not just relies
 * on the next layer to catch it).
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await login({ email, password });
      await refresh();
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/account") ? next : "/account");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof AuthApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Container className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-8">
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
            <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-brand-700 hover:underline">
              Forgot password?
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

        <p className="text-center text-sm text-neutral-600">
          New customer?{" "}
          <Link href="/signup" className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
      </form>

      <p className="mt-6 text-center text-xs text-neutral-500">
        Service Provider or Admin?{" "}
        <Link href="/staff/login" className="font-medium text-neutral-700 hover:underline">
          Sign in here
        </Link>
      </p>
    </Container>
  );
}

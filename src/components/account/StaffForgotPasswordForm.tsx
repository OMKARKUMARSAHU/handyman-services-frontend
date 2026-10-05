"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { staffForgotPassword, AuthApiError } from "@/lib/auth/api";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";

/**
 * Shared Admin/Provider forgot-password — real Cognito ForgotPassword
 * (FINAL AUTHENTICATION ARCHITECTURE §8), mirroring the Customer
 * `/forgot-password` flow exactly, against the staff endpoint instead. No
 * Admin signup link anywhere on this page or the one it leads to.
 */
export function StaffForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await staffForgotPassword({ email });
      router.push(`/staff/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof AuthApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Container className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
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

        {status === "error" && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full">
          {status === "submitting" ? "Sending…" : "Send reset code"}
        </Button>

        <p className="text-center text-sm text-neutral-600">
          <Link href="/staff/login" className="font-medium text-brand-700 hover:underline">
            Back to Staff Login
          </Link>
        </p>
      </form>
    </Container>
  );
}

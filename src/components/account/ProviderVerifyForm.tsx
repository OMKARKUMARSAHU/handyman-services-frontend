"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { confirmProviderSignup, resendProviderCode, AuthApiError } from "@/lib/auth/api";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";

/**
 * Service Provider email verification — real Cognito CONFIRM_WITH_CODE,
 * mirroring the Customer `VerifyForm`. On success the backend assigns the
 * `provider` Cognito group (never this frontend) and the application stays
 * PENDING_APPROVAL until an admin reviews it.
 */
export function ProviderVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await confirmProviderSignup({ email, code });
      router.push("/staff/login?verified=1");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof AuthApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function handleResend() {
    setResendStatus("sending");
    try {
      await resendProviderCode({ email });
      setResendStatus("sent");
    } catch {
      setResendStatus("idle");
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
            className={inputClasses}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="code" className={labelClasses}>
            Verification code *
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            required
            className={inputClasses}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        {status === "error" && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full">
          {status === "submitting" ? "Verifying…" : "Verify email"}
        </Button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resendStatus === "sending" || !email}
          className="w-full text-center text-sm font-medium text-brand-700 hover:underline disabled:opacity-50"
        >
          {resendStatus === "sent" ? "Code resent — check your inbox" : "Resend code"}
        </button>
      </form>
    </Container>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { staffConfirmForgotPassword, AuthApiError } from "@/lib/auth/api";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";

export function StaffResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await staffConfirmForgotPassword({ email, code, newPassword });
      router.push("/staff/login?reset=1");
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
            className={inputClasses}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="code" className={labelClasses}>
            Reset code *
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
        <div>
          <label htmlFor="newPassword" className={labelClasses}>
            New password *
          </label>
          <PasswordInput id="newPassword" required autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
          <p className="mt-1.5 text-xs text-neutral-500">
            At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.
          </p>
        </div>

        {status === "error" && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full">
          {status === "submitting" ? "Resetting…" : "Reset password"}
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { forgotPassword, AuthApiError } from "@/lib/auth/api";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await forgotPassword({ email });
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof AuthApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <PageHeader heading="Forgot password" subheading="We'll email you a code to reset it." />
      <section className="py-14">
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

            {status === "error" && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {errorMessage}
              </p>
            )}

            <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full">
              {status === "submitting" ? "Sending…" : "Send reset code"}
            </Button>
          </form>
        </Container>
      </section>
    </>
  );
}

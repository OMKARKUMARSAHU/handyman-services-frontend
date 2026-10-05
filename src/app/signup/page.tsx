"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { signup, AuthApiError } from "@/lib/auth/api";

const inputClasses =
  "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClasses = "mb-1.5 block text-sm font-medium text-neutral-800";

/**
 * Customer self-signup (AUTHENTICATION & AUTHORIZATION PHASE — Provider and
 * Admin deliberately have NO signup page: their accounts are provisioned
 * out-of-band by an operator, a business decision this phase flagged as not
 * yet confirmed rather than guessed at; see the phase's final report).
 */
export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await signup({ name, email, password });
      router.push(`/verify?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof AuthApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <PageHeader heading="Create your account" subheading="Sign up to track orders and save your details." />
      <section className="py-14">
        <Container className="max-w-md">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-8">
            <div>
              <label htmlFor="name" className={labelClasses}>
                Full name *
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                className={inputClasses}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
              <label htmlFor="password" className={labelClasses}>
                Password *
              </label>
              <PasswordInput id="password" required autoComplete="new-password" value={password} onChange={setPassword} />
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
              {status === "submitting" ? "Creating account…" : "Create account"}
            </Button>

            <p className="text-center text-sm text-neutral-600">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-brand-700 hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </Container>
      </section>
    </>
  );
}

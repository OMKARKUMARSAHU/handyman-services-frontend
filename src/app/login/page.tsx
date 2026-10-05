import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoginForm } from "@/components/account/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Handyman Services account.",
};

export default function LoginPage() {
  return (
    <>
      <PageHeader heading="Login" subheading="Sign in to your customer account." />
      <section className="py-14">
        <Suspense fallback={<div className="text-center text-sm text-neutral-500">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StaffLoginForm } from "@/components/account/StaffLoginForm";

export const metadata: Metadata = { title: "Staff Login" };

export default function StaffLoginPage() {
  return (
    <>
      <PageHeader heading="Staff Login" subheading="Admin and Service Provider sign-in — your role decides what you can access." />
      <section className="py-14">
        <Suspense fallback={<div className="text-center text-sm text-neutral-500">Loading…</div>}>
          <StaffLoginForm />
        </Suspense>
      </section>
    </>
  );
}

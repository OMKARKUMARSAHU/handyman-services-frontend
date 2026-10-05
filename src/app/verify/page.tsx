import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { VerifyForm } from "@/components/account/VerifyForm";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyPage() {
  return (
    <>
      <PageHeader heading="Verify your email" subheading="Enter the verification code we emailed you." />
      <section className="py-14">
        <Suspense fallback={<div className="text-center text-sm text-neutral-500">Loading…</div>}>
          <VerifyForm />
        </Suspense>
      </section>
    </>
  );
}

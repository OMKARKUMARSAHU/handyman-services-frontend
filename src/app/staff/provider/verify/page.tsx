import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProviderVerifyForm } from "@/components/account/ProviderVerifyForm";

export const metadata: Metadata = { title: "Verify your email — Service Provider" };

export default function ProviderVerifyPage() {
  return (
    <>
      <PageHeader heading="Verify your email" subheading="Enter the verification code we emailed you to finish your application." />
      <section className="py-14">
        <Suspense fallback={<div className="text-center text-sm text-neutral-500">Loading…</div>}>
          <ProviderVerifyForm />
        </Suspense>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <>
      <PageHeader heading="Reset password" subheading="Enter the code we emailed you and your new password." />
      <section className="py-14">
        <Suspense fallback={<div className="text-center text-sm text-neutral-500">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </>
  );
}

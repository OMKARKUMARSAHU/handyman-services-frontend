import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StaffResetPasswordForm } from "@/components/account/StaffResetPasswordForm";

export const metadata: Metadata = { title: "Staff Reset Password" };

export default function StaffResetPasswordPage() {
  return (
    <>
      <PageHeader heading="Reset password" subheading="Enter the code we emailed you and your new password." />
      <section className="py-14">
        <Suspense fallback={<div className="text-center text-sm text-neutral-500">Loading…</div>}>
          <StaffResetPasswordForm />
        </Suspense>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { StaffForgotPasswordForm } from "@/components/account/StaffForgotPasswordForm";

export const metadata: Metadata = { title: "Staff Forgot Password" };

export default function StaffForgotPasswordPage() {
  return (
    <>
      <PageHeader heading="Forgot password" subheading="Staff Portal — we'll email you a code to reset it." />
      <section className="py-14">
        <StaffForgotPasswordForm />
      </section>
    </>
  );
}

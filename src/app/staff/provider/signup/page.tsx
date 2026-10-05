import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProviderSignupForm } from "@/components/account/ProviderSignupForm";

export const metadata: Metadata = {
  title: "Join as a Service Provider",
  description: "Apply to join the Handyman Services provider network.",
};

export default function ProviderSignupPage() {
  return (
    <>
      <PageHeader
        heading="Join as a Service Provider"
        subheading="Apply to list your services. An administrator reviews every application before it goes live."
      />
      <section className="py-14">
        <ProviderSignupForm />
      </section>
    </>
  );
}

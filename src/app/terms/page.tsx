import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Handyman Services Terms & Conditions.",
};

export default function TermsPage() {
  return (
    <>
      <PageHeader heading="Terms & Conditions" />
      <section className="py-12 sm:py-16">
        <Container className="max-w-3xl">
          <div className="prose prose-neutral space-y-6 text-sm text-neutral-700">
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Use of Service</h2>
              <p className="mt-2">
                By booking a service or plan through Handyman Services, you agree to
                provide accurate contact and address details so a technician can be
                scheduled correctly. Service visits are carried out by certified
                technician partners in our network.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Plans & Payments</h2>
              <p className="mt-2">
                Plan coverage, visit entitlements and pricing are as described on our
                Plans page at the time of purchase. Any changes to a plan will be
                communicated before they take effect.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Changes to These Terms</h2>
              <p className="mt-2">
                We may update these terms from time to time. The latest version will
                always be available on this page.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Contact Us</h2>
              <p className="mt-2">
                Questions about these terms can be sent to us via the contact details
                on our Contact page.
              </p>
            </section>
          </div>
        </Container>
      </section>
    </>
  );
}

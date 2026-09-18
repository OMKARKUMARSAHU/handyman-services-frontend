import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Handyman Services Privacy Policy.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader heading="Privacy Policy" />
      <section className="py-12 sm:py-16">
        <Container className="max-w-3xl">
          <div className="prose prose-neutral space-y-6 text-sm text-neutral-700">
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Information We Collect</h2>
              <p className="mt-2">
                When you request a service or contact us, we collect the details you
                provide — such as your name, phone number, email, and address — so we
                can schedule and carry out your service.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-neutral-900">How We Use Information</h2>
              <p className="mt-2">
                Your information is used to respond to your request, schedule
                technician visits, and share updates about your service. We do not
                sell your information to third parties.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Contact Us</h2>
              <p className="mt-2">
                If you have questions about how your information is handled, reach
                out to us via the contact details on our Contact page.
              </p>
            </section>
          </div>
        </Container>
      </section>
    </>
  );
}

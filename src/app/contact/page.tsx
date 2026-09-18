import type { Metadata } from "next";
import { Suspense } from "react";
import { getPlans, getAppliances, getContactInfo, getTelLink, getWhatsAppLink } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/forms/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us / Request a Service",
  description:
    "Get in touch with Handyman Services or request a service — call, WhatsApp, or fill in the form and our team will reach out.",
};

export default function ContactPage() {
  const plans = getPlans();
  const appliances = getAppliances();
  const contact = getContactInfo();

  return (
    <>
      <PageHeader
        heading="Contact Us"
        subheading="Fill in your details and our team will reach out shortly."
      />

      <section className="py-12 sm:py-16">
        <Container className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<div className="text-sm text-neutral-500">Loading form…</div>}>
              <ContactForm plans={plans} appliances={appliances} />
            </Suspense>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Reach us directly
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a href={getTelLink()} className="font-semibold text-brand-700 hover:underline">
                    {contact.phone}
                  </a>
                </li>
                <li>
                  <a
                    href={getWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-green-700 hover:underline"
                  >
                    Chat on WhatsApp
                  </a>
                </li>
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className="text-neutral-700 hover:underline">
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.address && <li className="text-neutral-700">{contact.address}</li>}
                {contact.hours && <li className="text-neutral-700">{contact.hours}</li>}
              </ul>
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}

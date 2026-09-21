import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { ProfileImageSlot } from "@/components/home/ProfileImageSlot";
import { Icon } from "@/lib/icons";
import { getHomepageSection } from "@/lib/data";
import { getServiceTypesSync } from "@/lib/data/serviceTypes";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Handyman Services connects homes with technicians for appliance installation, service, repair and AMC — browse by category and book what you need.",
};

// Presentational-only icon per service type (ServiceType itself has no icon
// field — this is a small local UI mapping, not a data-model change).
const SERVICE_TYPE_ICON: Record<string, string> = {
  installation: "wrench",
  service: "shield-check",
  repair: "zap",
  amc: "badge-check",
};

/**
 * Phase 3 final visual-audit pass (item 7): the previous version was two
 * plain paragraphs of text — accurate copy, but it read as a static
 * "about us" page rather than something tied to the marketplace it's
 * linked from (the new footer's Company column). Added a real service-type
 * chip row (data-driven via getServiceTypesSync() — the same DAL read the
 * footer uses, no new claims) and a "Browse Services" CTA, so the page
 * connects back into the actual product instead of just describing it.
 * Kept intentionally simple — no new sections, no invented company claims.
 */
export default function AboutPage() {
  const whyChooseUsSection = getHomepageSection("whyChooseUs");
  const serviceTypes = getServiceTypesSync();
  // See ProfileImageSlot's doc comment: existence is checked here, server
  // side, rather than relying solely on a client-side onError fallback.
  const founderPhotoExists = fs.existsSync(
    path.join(process.cwd(), "public", "images", "team", "founder.jpg")
  );

  return (
    <>
      <PageHeader
        heading="About Handyman Services"
        subheading="A simple promise: reliable appliance service, when you need it."
      />

      <section className="py-12 sm:py-16">
        <Container className="max-w-3xl">
          <div className="prose prose-neutral">
            <p className="text-base text-neutral-700">
              Handyman Services exists to take the stress out of appliance
              upkeep. Instead of scrambling to find a technician every time
              something breaks, browse by category, book the exact service
              you need — installation, service, repair or AMC — and get a
              WhatsApp summary after every visit.
            </p>
            <p className="mt-4 text-base text-neutral-700">
              We&rsquo;re expanding city by city — pick your city to see
              exactly which services are available near you today.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {serviceTypes.map((type) => (
              <span
                key={type.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700"
              >
                <Icon
                  name={SERVICE_TYPE_ICON[type.key] ?? "wrench"}
                  className="h-4 w-4 text-brand-600"
                />
                {type.label}
              </span>
            ))}
          </div>

          <Button href="/services" className="mt-8">
            Browse Services
          </Button>

          {/*
            Phase 3 "major homepage visual rework" pass (item 18): a
            client-requested profile-type visual, with no image file or
            specific person supplied yet. Rather than inventing a photo or
            identity, this is a properly proportioned placeholder slot
            (square, matching the aspect ratio a real headshot would use)
            that shows a neutral icon until a real photo is dropped at
            `public/images/team/founder.jpg` — no code change needed then,
            same pattern as every other image slot in this project.
          */}
          <div className="mt-10 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <ProfileImageSlot
              src="/images/team/founder.jpg"
              alt="Handyman Services team"
              exists={founderPhotoExists}
              className="h-16 w-16 shrink-0 rounded-full"
            />
            <div>
              <p className="text-sm font-bold text-neutral-900">Handyman Services</p>
              <p className="text-sm text-neutral-500">Built and run by a small local team.</p>
            </div>
          </div>
        </Container>
      </section>

      {whyChooseUsSection && (
        <section className="bg-neutral-50 py-12 sm:py-16">
          <SectionHeading heading={whyChooseUsSection.heading} />
          <div className="mt-10">
            <WhyChooseUs section={whyChooseUsSection} />
          </div>
        </section>
      )}
    </>
  );
}

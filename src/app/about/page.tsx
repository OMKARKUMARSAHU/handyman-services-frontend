import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { getHomepageSection } from "@/lib/data";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Handyman Services connects homes with vetted, certified technicians through simple annual appliance-care plans.",
};

export default function AboutPage() {
  const whyChooseUsSection = getHomepageSection("whyChooseUs");

  return (
    <>
      <PageHeader
        heading="About Handyman Services"
        subheading="A simple promise: your appliances, always running."
      />

      <section className="py-12 sm:py-16">
        <Container className="max-w-3xl">
          <div className="prose prose-neutral">
            <p className="text-base text-neutral-700">
              Handyman Services exists to take the stress out of appliance
              upkeep. Instead of scrambling to find a technician every time
              something breaks, our annual plans put a certified partner on
              call — with visits scheduled in advance and a WhatsApp report
              after every one.
            </p>
            <p className="mt-4 text-base text-neutral-700">
              We currently serve homes across India with Silver, Gold and
              Platinum coverage tiers, designed to match everything from a
              single appliance to whole-home coverage.
            </p>
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

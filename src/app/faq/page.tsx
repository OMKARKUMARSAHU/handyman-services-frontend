import type { Metadata } from "next";
import { getFAQs } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { FAQAccordion } from "@/components/home/FAQAccordion";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers to common questions about Handyman Services' appliance plans.",
};

export default function FAQPage() {
  const faqs = getFAQs();

  return (
    <>
      <PageHeader heading="Frequently Asked Questions" />
      <section className="py-12 sm:py-16">
        <Container className="max-w-3xl">
          <FAQAccordion faqs={faqs} />
        </Container>
      </section>
    </>
  );
}

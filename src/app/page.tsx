import type { Metadata } from "next";
import {
  getHomepageSection,
  getCategories,
  getPlans,
  getTestimonials,
  getFAQs,
} from "@/lib/data";
import { Hero } from "@/components/home/Hero";
import { TrustStatsBand } from "@/components/home/TrustStatsBand";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { PlanComparisonTable } from "@/components/plans/PlanComparisonTable";
import { HowItWorks } from "@/components/home/HowItWorks";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { TestimonialCarousel } from "@/components/home/TestimonialCarousel";
import { FAQAccordion } from "@/components/home/FAQAccordion";
import { CTASection } from "@/components/home/CTASection";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Handyman Services — Your home appliances, always running.",
  description:
    "One annual plan covers all your appliances. Vetted, certified technicians, WhatsApp visit reports, and priority support across Silver, Gold and Platinum plans.",
};

export default function HomePage() {
  const heroSection = getHomepageSection("hero");
  const trustStatsSection = getHomepageSection("trustStats");
  const howItWorksSection = getHomepageSection("howItWorks");
  const whyChooseUsSection = getHomepageSection("whyChooseUs");
  const finalCtaSection = getHomepageSection("finalCta");
  const categories = getCategories();
  const plans = getPlans();
  const testimonials = getTestimonials();
  const faqs = getFAQs();

  return (
    <>
      {heroSection && <Hero section={heroSection} />}
      {trustStatsSection && <TrustStatsBand section={trustStatsSection} />}

      <section className="py-16 sm:py-20">
        <SectionHeading
          eyebrow="Browse by Category"
          heading="What do you need serviced?"
          subheading="Explore appliance categories to see exactly what's covered under each plan."
        />
        <div className="mt-10">
          <CategoryGrid categories={categories} />
        </div>
      </section>

      <section id="plans" className="bg-neutral-50 py-16 sm:py-20">
        <SectionHeading
          eyebrow="Plans & Pricing"
          heading="Simple plans for every home"
          subheading="Choose the plan that fits your appliances — upgrade any time."
        />
        <Container className="mt-10">
          <PlanComparisonTable plans={plans} />
        </Container>
      </section>

      {howItWorksSection && (
        <section id="how-it-works" className="py-16 sm:py-20">
          <SectionHeading heading={howItWorksSection.heading} subheading={howItWorksSection.subheading} />
          <div className="mt-10">
            <HowItWorks section={howItWorksSection} />
          </div>
        </section>
      )}

      {whyChooseUsSection && (
        <section className="bg-neutral-50 py-16 sm:py-20">
          <SectionHeading heading={whyChooseUsSection.heading} />
          <div className="mt-10">
            <WhyChooseUs section={whyChooseUsSection} />
          </div>
        </section>
      )}

      <section className="py-16 sm:py-20">
        <SectionHeading
          eyebrow="Testimonials"
          heading="What our customers say"
        />
        <div className="mt-10">
          <TestimonialCarousel testimonials={testimonials} />
        </div>
      </section>

      <section id="faq" className="bg-neutral-50 py-16 sm:py-20">
        <SectionHeading eyebrow="FAQ" heading="Frequently asked questions" />
        <Container className="mt-10 max-w-3xl">
          <FAQAccordion faqs={faqs} />
          <p className="mt-4 text-center text-sm text-neutral-500">
            Have another question?{" "}
            <Button href="/faq" variant="ghost" size="md" className="px-1">
              View the full FAQ
            </Button>
          </p>
        </Container>
      </section>

      {finalCtaSection && <CTASection section={finalCtaSection} />}
    </>
  );
}

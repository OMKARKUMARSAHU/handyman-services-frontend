import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import type { HomepageSection } from "@/types";

export function CTASection({ section }: { section: HomepageSection }) {
  return (
    <section className="bg-brand-700 py-14">
      <Container className="flex flex-col items-center gap-6 text-center">
        <h2 className="max-w-2xl text-2xl font-bold text-white sm:text-3xl">
          {section.heading}
        </h2>
        {section.subheading && (
          <p className="max-w-xl text-brand-100">{section.subheading}</p>
        )}
        {section.ctaText && section.ctaLink && (
          <Button href={section.ctaLink} size="lg" variant="secondary">
            {section.ctaText}
          </Button>
        )}
      </Container>
    </section>
  );
}

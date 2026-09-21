import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import type { HomepageSection } from "@/types";

/**
 * Phase 3 "major homepage visual rework" pass (item 1/17): was a solid
 * `bg-brand-700` block — one of the largest single green fills on the
 * page. Switched to the same dark-neutral surface the footer already uses
 * (`bg-neutral-900`), so this section reads as a deliberate dark closing
 * band that flows into the footer, with the brand color reserved for the
 * button (a small, restrained accent) rather than the whole section.
 */
export function CTASection({ section }: { section: HomepageSection }) {
  return (
    <section className="bg-neutral-900 py-14">
      <Container className="flex flex-col items-center gap-6 text-center">
        <h2 className="max-w-2xl text-2xl font-bold text-white sm:text-3xl">
          {section.heading}
        </h2>
        {section.subheading && (
          <p className="max-w-xl text-neutral-300">{section.subheading}</p>
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

import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import type { HomepageSection } from "@/types";

export function Hero({ section }: { section: HomepageSection }) {
  const secondaryCtaText = section.items?.find((i) => i.label === "secondaryCtaText")
    ?.value as string | undefined;
  const secondaryCtaLink = section.items?.find((i) => i.label === "secondaryCtaLink")
    ?.value as string | undefined;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white py-16 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="mb-4 inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            500+ Homes Served
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
            {section.heading}
          </h1>
          {section.subheading && (
            <p className="mt-5 max-w-xl text-lg text-neutral-600">
              {section.subheading}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-4">
            {section.ctaText && section.ctaLink && (
              <Button href={section.ctaLink} size="lg">
                {section.ctaText}
              </Button>
            )}
            {secondaryCtaText && secondaryCtaLink && (
              <Button href={secondaryCtaLink} size="lg" variant="outline">
                {secondaryCtaText}
              </Button>
            )}
          </div>
        </div>

        {section.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external/local business photo, optimized separately per PHASE_4_FRONTEND_POLISH_REPORT.md
          <img
            src={section.image}
            alt={section.imageAlt ?? ""}
            className="relative mx-auto aspect-[4/3] w-full max-w-md rounded-2xl object-cover shadow-xl"
          />
        ) : (
          <div className="relative mx-auto aspect-[4/3] w-full max-w-md rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-xl">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-white">
              <span className="text-sm font-semibold uppercase tracking-wide text-brand-100">
                One Plan. Every Appliance.
              </span>
              <span className="text-2xl font-bold">Certified technicians, on schedule.</span>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}

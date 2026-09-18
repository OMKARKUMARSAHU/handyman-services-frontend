import { Container } from "./Container";

/** Simplified Hero variant for interior pages (Services, About, Plans, FAQ, Contact). */
export function PageHeader({
  heading,
  subheading,
}: {
  heading: string;
  subheading?: string;
}) {
  return (
    <section className="border-b border-neutral-200 bg-gradient-to-b from-brand-50 to-white py-12 sm:py-16">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
          {heading}
        </h1>
        {subheading && (
          <p className="mt-3 max-w-2xl text-base text-neutral-600 sm:text-lg">
            {subheading}
          </p>
        )}
      </Container>
    </section>
  );
}

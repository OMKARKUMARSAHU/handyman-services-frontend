import { Container } from "@/components/ui/Container";
import type { HomepageSection } from "@/types";

export function TrustStatsBand({ section }: { section: HomepageSection }) {
  const stats = section.items ?? [];

  return (
    <section aria-label={section.heading} className="border-y border-neutral-200 bg-white py-10">
      <Container>
        <div className="grid grid-cols-3 gap-4 divide-x divide-neutral-200 text-center">
          {stats.map((stat, i) => (
            <div key={i} className="px-2">
              <div className="text-2xl font-extrabold text-brand-700 sm:text-3xl">
                {stat.value}
              </div>
              <div className="mt-1 text-xs font-medium text-neutral-500 sm:text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

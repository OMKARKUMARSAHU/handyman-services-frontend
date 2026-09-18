import { Container } from "@/components/ui/Container";
import type { HomepageSection } from "@/types";

export function HowItWorks({ section }: { section: HomepageSection }) {
  const steps = section.items ?? [];

  return (
    <Container>
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li key={i} className="relative rounded-2xl border border-neutral-200 bg-white p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {step.number}
            </span>
            <h3 className="mt-4 text-base font-bold text-neutral-900">{step.title}</h3>
            <p className="mt-1.5 text-sm text-neutral-600">{step.description}</p>
          </li>
        ))}
      </ol>
    </Container>
  );
}

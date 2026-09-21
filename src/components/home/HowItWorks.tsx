import { Container } from "@/components/ui/Container";
import type { HomepageSection } from "@/types";

/**
 * Phase 3 "major homepage visual rework" pass (item 8): was 4 large
 * bordered cards in its own full-width section — competing with the
 * marketplace catalog above it for visual weight, and (per the client's
 * flag) implying more automation ("We Match a Technician" / "Track
 * Everything") than this mock-data phase actually has. Rewritten as a
 * single slim horizontal strip of small numbered steps — no per-step
 * cards, no icons, just number + short label — and moved lower on the
 * page, after the catalog sections. Step copy itself is unchanged (it was
 * already reviewed for unimplemented claims in an earlier round); this is
 * a layout-only compaction.
 */
export function HowItWorks({ section }: { section: HomepageSection }) {
  const steps = section.items ?? [];

  return (
    <Container>
      <ol className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white sm:flex-row sm:divide-x sm:divide-y-0">
        {steps.map((step, i) => (
          <li key={i} className="flex flex-1 items-start gap-3 p-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {step.number}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-900">{step.title}</h3>
              <p className="mt-0.5 text-xs text-neutral-500">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </Container>
  );
}

import { Container } from "@/components/ui/Container";
import type { HomepageSection } from "@/types";

/**
 * Renders a homepage-sections.json "trustStats" section as a row of stat
 * callouts (e.g. "500+ Happy Homes", "48hr Response Time", "4.8★ Avg.
 * Rating"). Not currently used anywhere (Phase 3 final-polish pass, item
 * 2) — those figures are unconfirmed demo/mock values with no real
 * booking-volume, SLA, or review data behind them, so rendering them would
 * present them as verified production facts. Kept as-is, ready to wire
 * back into app/page.tsx the moment the client confirms real numbers —
 * this component itself makes no claim about where its data comes from.
 */
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

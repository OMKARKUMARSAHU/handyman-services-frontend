"use client";

import { Icon } from "@/lib/icons";
import { HorizontalScrollIndicator } from "@/components/ui/HorizontalScrollIndicator";
import { useHorizontalScrollIndicator } from "@/lib/hooks/useHorizontalScrollIndicator";
import type { HomepageSection } from "@/types";

/**
 * Compact homepage trust strip (Phase 3 "major homepage visual rework"
 * pass, item 3/9). Two things this reconciles:
 *
 * - Item 3's suggested homepage order calls for a "Trust / rating /
 *   customer statistics" section near the top. The previous round removed
 *   the old trustStats band ("500+ Happy Homes," "48hr Response Time,"
 *   "4.8★ Avg. Rating") because those specific figures are unconfirmed
 *   mock data with no real booking/SLA/review numbers behind them — that
 *   reasoning still holds, so this section does not bring fabricated
 *   statistics back (see TrustStatsBand.tsx's doc comment; that data/
 *   component are still just kept, not rendered).
 * - Item 9 asks that "Why Choose Us" not dominate the homepage as a large
 *   card section, and be folded into a smaller trust section instead.
 *
 * This is that fold: the same `whyChooseUs` section items (Dedicated
 * Technician Visits / WhatsApp Service Reports / No Hidden Charges /
 * Emergency Call-out — all real, already-implemented practices, not
 * numeric claims), shown once, as a single compact row directly under the
 * hero rather than as a large card grid further down the page. The old
 * full-size "Why Choose Us" section is not rendered separately anymore to
 * avoid showing the same 4 items twice.
 */
export function TrustStrip({ section }: { section: HomepageSection }) {
  const items = section.items ?? [];
  const { ref: scrollRef, state: scrollState } = useHorizontalScrollIndicator<HTMLDivElement>(
    items.length
  );

  if (items.length === 0) return null;

  return (
    <section className="border-b border-neutral-200 bg-neutral-50/60 py-5">
      <div
        ref={scrollRef}
        role="region"
        aria-label="Why choose us — scrollable list"
        tabIndex={0}
        className="mx-auto flex w-full max-w-7xl gap-4 overflow-x-auto px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-6 lg:grid-cols-4 lg:px-8"
      >
        {items.map((item, i) => (
          <div key={i} className="flex min-w-[220px] shrink-0 items-center gap-3 sm:min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-neutral-200">
              <Icon name={String(item.icon ?? "shield-check")} className="h-4 w-4" />
            </span>
            <span className="text-xs font-medium leading-tight text-neutral-700">
              {item.title}
            </span>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <HorizontalScrollIndicator state={scrollState} />
      </div>
    </section>
  );
}

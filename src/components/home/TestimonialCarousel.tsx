"use client";

import { Container } from "@/components/ui/Container";
import { HorizontalScrollIndicator } from "@/components/ui/HorizontalScrollIndicator";
import { useHorizontalScrollIndicator } from "@/lib/hooks/useHorizontalScrollIndicator";
import type { Testimonial } from "@/types";
import { TestimonialCard } from "./TestimonialCard";

/**
 * Horizontally scrollable on mobile (snap-scroll single card), a static
 * grid on larger screens — matches PHASE_2_UI_UX_DESIGN.md §6 responsive
 * behavior for testimonials. `useHorizontalScrollIndicator` naturally
 * reports `hasOverflow: false` once the `sm:grid`/`sm:overflow-visible`
 * breakpoint kicks in, so the indicator only ever shows on the mobile
 * scroll layout with no extra breakpoint logic here.
 */
export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const { ref: scrollRef, state: scrollState } = useHorizontalScrollIndicator<HTMLDivElement>(
    testimonials.map((t) => t.id).join(",")
  );

  return (
    <Container>
      <div
        ref={scrollRef}
        role="region"
        aria-label="Customer testimonials — scrollable list"
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3"
      >
        {testimonials.map((t) => (
          <div key={t.id} className="w-[85%] shrink-0 snap-center sm:w-auto">
            <TestimonialCard testimonial={t} />
          </div>
        ))}
      </div>
      <HorizontalScrollIndicator state={scrollState} />
    </Container>
  );
}

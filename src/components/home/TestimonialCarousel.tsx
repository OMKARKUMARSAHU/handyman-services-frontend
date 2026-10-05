"use client";

import { Container } from "@/components/ui/Container";
import { HorizontalRailNavigation } from "@/components/ui/HorizontalRailNavigation";
import { useHorizontalRailScroll } from "@/lib/hooks/useHorizontalRailScroll";
import type { Testimonial } from "@/types";
import { TestimonialCard } from "./TestimonialCard";

/**
 * Horizontally scrollable on mobile (snap-scroll single card), a static
 * grid on larger screens — matches PHASE_2_UI_UX_DESIGN.md §6 responsive
 * behavior for testimonials. `useHorizontalRailScroll` naturally reports
 * both `canScrollLeft`/`canScrollRight` as `false` once the
 * `sm:grid`/`sm:overflow-visible` breakpoint kicks in, so the edge arrows
 * only ever show on the mobile scroll layout with no extra breakpoint
 * logic here.
 *
 * Note: this component is not currently mounted on any page (testimonials
 * were removed from the homepage as mock/placeholder data in an earlier
 * phase — see `src/app/page.tsx`), so this change is verified via
 * tsc/lint/build only, same as it was for the previous scroll-indicator
 * phase.
 */
export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const { ref: scrollRef, canScrollLeft, canScrollRight, onScrollLeft, onScrollRight } =
    useHorizontalRailScroll<HTMLDivElement>(testimonials.map((t) => t.id).join(","));

  return (
    <Container>
      <div className="relative">
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
        <HorizontalRailNavigation
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
          onScrollLeft={onScrollLeft}
          onScrollRight={onScrollRight}
          label="Customer testimonials"
        />
      </div>
    </Container>
  );
}

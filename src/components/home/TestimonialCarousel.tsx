import { Container } from "@/components/ui/Container";
import type { Testimonial } from "@/types";
import { TestimonialCard } from "./TestimonialCard";

/**
 * Horizontally scrollable on mobile (snap-scroll single card), a static
 * grid on larger screens — matches PHASE_2_UI_UX_DESIGN.md §6 responsive
 * behavior for testimonials without requiring extra client-side JS.
 */
export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <Container>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
        {testimonials.map((t) => (
          <div key={t.id} className="w-[85%] shrink-0 snap-center sm:w-auto">
            <TestimonialCard testimonial={t} />
          </div>
        ))}
      </div>
    </Container>
  );
}

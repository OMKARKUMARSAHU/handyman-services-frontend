import testimonialsData from "@/data/testimonials.json";
import type { Testimonial } from "@/types";

export function getTestimonials(
  { approvedOnly = true }: { approvedOnly?: boolean } = {}
): Testimonial[] {
  return (testimonialsData as Testimonial[])
    .filter((t) => (approvedOnly ? t.approved : true))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

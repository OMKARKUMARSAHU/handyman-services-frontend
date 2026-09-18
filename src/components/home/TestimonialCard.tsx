import type { Testimonial } from "@/types";

export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-6">
      <div role="img" aria-label={`${testimonial.rating} out of 5 stars`} className="mb-3 flex gap-0.5 text-accent-500">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            fill={i < testimonial.rating ? "currentColor" : "none"}
            stroke="currentColor"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3-5.4 3 1.3-6-4.6-4.1 6.1-.6L10 1.5z" />
          </svg>
        ))}
      </div>
      <blockquote className="flex-1 text-sm text-neutral-700">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-4 text-sm">
        <span className="font-semibold text-neutral-900">{testimonial.name}</span>
        <span className="text-neutral-500"> · {testimonial.city}</span>
      </figcaption>
    </figure>
  );
}

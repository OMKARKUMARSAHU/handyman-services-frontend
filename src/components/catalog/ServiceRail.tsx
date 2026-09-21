import Link from "next/link";
import type { Service } from "@/types";
import { Container } from "@/components/ui/Container";
import { ServiceCard } from "./ServiceCard";

/**
 * Horizontal-scroll service rail — the card/rail pattern used throughout
 * the Urban Company reference for "New & Noteworthy," "Most Booked," and
 * category-wise browsing (layout/IA reference only, per the client's
 * instruction; markup, styling and content are original to Handyman
 * Services). Reuses the existing `ServiceCard` so pricing/rating/cart
 * behavior stays identical to the grid views elsewhere in the app.
 *
 * Renders nothing when `services` is empty — an honest omission rather
 * than a broken-looking empty rail, consistent with the project's existing
 * empty-state practice (see ServiceList).
 */
export function ServiceRail({
  eyebrow,
  heading,
  subheading,
  services,
  citySlug,
  seeAllHref,
}: {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  services: Service[];
  citySlug?: string;
  seeAllHref?: string;
}) {
  if (services.length === 0) return null;

  return (
    <section className="py-10 sm:py-12">
      <Container>
        <div className="flex items-end justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-brand-600">
                {eyebrow}
              </p>
            )}
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {heading}
            </h2>
            {subheading && <p className="mt-1 text-sm text-neutral-600">{subheading}</p>}
          </div>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="hidden shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800 sm:block"
            >
              See all
            </Link>
          )}
        </div>

        {/*
          Phase 3 final visual-audit pass: the rail intentionally shows a
          partial next card at the right edge as a scroll affordance, but a
          desktop-visible-everywhere mask-image fade (the previous
          approach) washed out real, readable card content — title, price,
          discount, the Add to Cart button — on every rail, which is a real
          defect, not a stylistic choice. Fixed by making the fade mobile
          <640px>-only and much subtler there (last 3% of width, just a
          hint that more content exists), and removing it entirely at `sm:`
          and up — desktop/tablet cards are never covered by anything; the
          peeking next card is simply left visibly, legibly clipped, same
          as any ordinary horizontal-scroll rail.
        */}
        <div
          role="region"
          aria-label={`${heading} — scrollable list`}
          tabIndex={0}
          className="-mx-4 mt-6 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-2 [mask-image:linear-gradient(to_right,black_97%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_97%,transparent_100%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 sm:mx-0 sm:px-0 sm:[mask-image:none] sm:[-webkit-mask-image:none] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {services.map((service) => (
            <div key={service.id} className="w-[220px] shrink-0 snap-start sm:w-[250px]">
              <ServiceCard service={service} citySlug={citySlug} />
            </div>
          ))}
        </div>

        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="mt-4 block text-center text-sm font-semibold text-brand-700 hover:text-brand-800 sm:hidden"
          >
            See all
          </Link>
        )}
      </Container>
    </section>
  );
}

import fs from "node:fs";
import path from "node:path";
import { Container } from "@/components/ui/Container";
import type { VideoCuration } from "@/types";
import { getCategoryById, getServiceTypeByIdSync } from "@/lib/data";
import { VideoCurationGallery, type VideoCurationGalleryItem } from "./VideoCurationGallery";

/**
 * "Video Curations" homepage section — redesigned in the Post-QA Revision 2
 * ("PHASE 4 POST-QA REVISION 2 — HOMEPAGE MARKETPLACE VISUAL REWORK", item
 * 1) to be a visually prominent, clickable-with-popup section rather than a
 * plain white-background rail of static cards.
 *
 * Two changes from the previous version:
 *
 * 1. **Prominence.** This section now breaks from the page's white/neutral-50
 *    rhythm with its own full-bleed dark band (`bg-neutral-950`), larger
 *    cards (220/260/300px vs. the old 160/190px), and a bigger heading —
 *    the same "give each section its own visual purpose" reasoning the
 *    client asked for, applied to the one section that's inherently about
 *    watching something, not browsing a catalog.
 * 2. **The fs-based thumbnail-existence check moved here.** Making the
 *    cards clickable (opening `VideoCurationModal`) requires client-side
 *    state, so the card and its modal are now client components
 *    (`VideoCurationGallery`/`VideoCurationCard`/`VideoCurationModal`) — but
 *    `fs.existsSync` only works on the server. This component stays a
 *    server component specifically to keep doing that check per curation
 *    (same logic `VideoCurationCard.tsx` used to do itself) and hands the
 *    client boundary a plain, serializable `{ curation, thumbnailExists,
 *    tagLabel }[]` list — no Node API and no data-layer lookup needs to
 *    ship to the browser this way.
 *
 * Renders nothing when there are no active curations — same honest-
 * omission rule as every other rail in this project.
 */
export function VideoCurationRail({
  eyebrow,
  heading,
  subheading,
  curations,
}: {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  curations: VideoCuration[];
}) {
  if (curations.length === 0) return null;

  const items: VideoCurationGalleryItem[] = curations.map((curation) => ({
    curation,
    thumbnailExists:
      curation.thumbnail !== null &&
      fs.existsSync(path.join(process.cwd(), "public", curation.thumbnail)),
    tagLabel:
      (curation.serviceTypeId && getServiceTypeByIdSync(curation.serviceTypeId)?.label) ||
      (curation.categoryId && getCategoryById(curation.categoryId)?.name) ||
      null,
  }));

  return (
    <section className="bg-neutral-950 py-14 sm:py-16">
      <Container>
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-brand-400">
              {eyebrow}
            </p>
          )}
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{heading}</h2>
          {subheading && <p className="mt-2 text-sm text-white/60 sm:text-base">{subheading}</p>}
        </div>

        <VideoCurationGallery items={items} heading={heading} />
      </Container>
    </section>
  );
}

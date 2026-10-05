"use client";

import { useState } from "react";
import type { VideoCuration } from "@/types";
import { HorizontalRailNavigation } from "@/components/ui/HorizontalRailNavigation";
import { useHorizontalRailScroll } from "@/lib/hooks/useHorizontalRailScroll";
import { VideoCurationCard } from "./VideoCurationCard";
import { VideoCurationModal } from "./VideoCurationModal";

export interface VideoCurationGalleryItem {
  curation: VideoCuration;
  thumbnailExists: boolean;
  tagLabel: string | null;
}

/**
 * Client boundary for the Video Curations rail.
 *
 * `VideoCurationRail.tsx` (a server component) does the one thing that has
 * to run on the server — checking each curation's thumbnail against the
 * filesystem — and hands this component the already-resolved, fully
 * serializable `items` list. Everything interactive (which card is "open,"
 * the modal itself, moving between videos) lives here, one state value
 * shared by every card in the rail so only one modal instance ever exists.
 *
 * "FINAL HOMEPAGE / UX CORRECTION" additions (items 5 & 7), since
 * superseded by the EDGE ARROW NAVIGATION phase below:
 *  - State moved from "which curation is open" to "which index is open" so
 *    the modal can offer previous/next navigation between curations
 *    without closing and reopening.
 *  - Left/right arrow buttons scroll the rail via the shared
 *    `useHorizontalRailScroll`/`HorizontalRailNavigation` pair (this rail
 *    was the original model for that shared pattern) — shown at every
 *    breakpoint, including mobile, and only when that direction can
 *    actually still scroll. On touch devices the rail remains directly
 *    swipeable; the arrows are additive, not a replacement for that.
 *  - Closing the modal doesn't touch the rail's scroll position at all —
 *    the modal is a `position: fixed` portal to `document.body`, entirely
 *    outside this scrollable container, so there is nothing here that
 *    could move it. Body scroll is what the modal locks/restores (see
 *    VideoCurationModal.tsx), and this rail's own horizontal scroll
 *    offset is simply never touched by open/close.
 */
export function VideoCurationGallery({
  items,
  heading,
}: {
  items: VideoCurationGalleryItem[];
  heading: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const {
    ref: scrollerRef,
    canScrollLeft,
    canScrollRight,
    onScrollLeft,
    onScrollRight,
  } = useHorizontalRailScroll<HTMLDivElement>(items.map((i) => i.curation.id).join(","));

  const selected = selectedIndex != null ? items[selectedIndex]?.curation ?? null : null;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        role="region"
        aria-label={`${heading} — scrollable list`}
        tabIndex={0}
        className="-mx-4 mt-6 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-2 [mask-image:linear-gradient(to_right,black_97%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_97%,transparent_100%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 sm:mx-0 sm:gap-5 sm:px-0 sm:[mask-image:none] sm:[-webkit-mask-image:none] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {items.map(({ curation, thumbnailExists, tagLabel }, i) => (
          <VideoCurationCard
            key={curation.id}
            curation={curation}
            thumbnailExists={thumbnailExists}
            tagLabel={tagLabel}
            onOpen={() => setSelectedIndex(i)}
          />
        ))}
      </div>
      <HorizontalRailNavigation
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onScrollLeft={onScrollLeft}
        onScrollRight={onScrollRight}
        label={heading}
        tone="inverted"
      />

      <VideoCurationModal
        curation={selected}
        onClose={() => setSelectedIndex(null)}
        index={selectedIndex ?? undefined}
        total={items.length}
        onPrev={
          items.length > 1 && selectedIndex != null
            ? () => setSelectedIndex((i) => (i == null ? i : (i - 1 + items.length) % items.length))
            : undefined
        }
        onNext={
          items.length > 1 && selectedIndex != null
            ? () => setSelectedIndex((i) => (i == null ? i : (i + 1) % items.length))
            : undefined
        }
      />
    </div>
  );
}

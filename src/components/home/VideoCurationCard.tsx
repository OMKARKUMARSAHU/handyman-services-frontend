"use client";

import type { VideoCuration } from "@/types";
import { formatDuration } from "@/lib/format";
import { VideoCurationMedia } from "./VideoCurationMedia";

/**
 * One large vertical (reels-style, 9:16) card in the "Video Curations" rail
 * (Post-QA Revision 2 — larger, clickable, opens `VideoCurationModal`).
 *
 * A client component now (it needs an onClick), so the one server-only
 * piece of the previous version — checking whether `curation.thumbnail`
 * actually exists on disk via `fs.existsSync` — moved up to
 * `VideoCurationRail.tsx` (a server component) and arrives here as the
 * plain `thumbnailExists` boolean prop, same for `tagLabel` (resolved from
 * `categoryId`/`serviceTypeId` server-side too). Neither `fs` nor the data
 * layer's category/service-type lookups need to ship to the client this
 * way — only the small amount of already-resolved display data does.
 *
 * The card is a real `<button>` now, not a non-interactive `<div>`: every
 * curation opens `VideoCurationModal` on click, regardless of whether
 * `videoUrl`/`externalUrl` is set. What used to make "clickability" honest
 * (no dead link, no fake embed) is now enforced *inside* the modal instead
 * of by refusing to make the card interactive at all — see that
 * component's doc comment for the videoUrl/externalUrl/placeholder
 * branching. This is what lets a future Admin Panel populate real media
 * without any redesign here.
 */
export function VideoCurationCard({
  curation,
  thumbnailExists,
  tagLabel,
  onOpen,
}: {
  curation: VideoCuration;
  thumbnailExists: boolean;
  tagLabel: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`Play video: ${curation.title}`}
      className="group relative w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 text-left shadow-lg shadow-black/30 transition-transform duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 sm:w-[260px] md:w-[300px]"
    >
      <VideoCurationMedia
        thumbnail={curation.thumbnail}
        thumbnailExists={thumbnailExists}
        alt={curation.title}
      />

      {curation.durationSeconds != null && (
        <span className="absolute right-2.5 top-2.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {formatDuration(curation.durationSeconds)}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
        {tagLabel && (
          <span className="mb-1.5 inline-block rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-brand-700 shadow-sm">
            {tagLabel}
          </span>
        )}
        <p className="line-clamp-2 text-sm font-bold leading-snug text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.5)] sm:text-base">
          {curation.title}
        </p>
        {curation.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-white/80 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.5)] sm:text-sm">
            {curation.description}
          </p>
        )}
      </div>
    </button>
  );
}

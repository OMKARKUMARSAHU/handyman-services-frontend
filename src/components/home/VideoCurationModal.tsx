"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { VideoCuration } from "@/types";
import { Icon } from "@/lib/icons";
import { resolveVideoEmbed } from "@/lib/video/embed";
import { buildPlaylist, resolveActiveEntry, stepPlaylist } from "@/lib/video/playlist";

/**
 * The video viewer opened by a Video Curations card.
 *
 * Redesigned in the "FINAL HOMEPAGE / UX CORRECTION" pass (item 6). The
 * Post-QA Revision 2 version of this modal used a landscape `aspect-video`
 * (16:9) player — reviewed against the client's reference screenshots and
 * called out as insufficient: the cards themselves are large vertical 9:16
 * "reels"-style cards, so opening them into a *landscape* viewer read as a
 * mismatch. This version opens a large, centered, TALL/VERTICAL viewer
 * (`aspect-[9/16]` media area, height-driven sizing so it always fits the
 * viewport) instead — a darkened backdrop, a vertical media panel sized
 * off height (`h-[min(78vh,640px)]`, width follows from the aspect ratio)
 * rather than off width, a close button fixed top-right, and — new in this
 * pass — optional previous/next controls and a lightweight top progress
 * bar (Stories/Reels-style segmented bar, one segment per curation) when
 * more than one curation exists. All of this is genuinely optional: with
 * no `onPrev`/`onNext` passed (or a single curation), those controls and
 * the progress bar simply don't render — nothing here requires more than
 * one curation to work.
 *
 * VIDEO SHOWCASE PLAYLIST: a card with more than one video plays them one at
 * a time in this single player; Previous/Next (buttons and ArrowLeft/Right)
 * step through THAT card's own list only, wrapping at the ends, with a
 * "Video 2 of 4" label and one progress segment per video. There is no row of
 * clip thumbnails. A card with one video (or none) keeps the older
 * previous/next-card arrows.
 *
 * The client's instruction was: the card must open a popup even before any
 * real video file/URL exists — and the same component must become a real
 * player later without a redesign. That's still why the branching lives
 * entirely inside the media area, keyed off the same `VideoCuration`
 * fields the data model already carries:
 *  - `videoUrl` set -> a real local <video> player.
 *  - no `videoUrl` but `externalUrl` set -> an <iframe> embed.
 *  - neither set (true today, for all six mock curations) -> an honest,
 *    Handyman-branded "Video coming soon" placeholder — never a fake
 *    embed, never a fabricated YouTube/Instagram URL, matching the same
 *    nullable-media honesty pattern used everywhere else in this project
 *    (see VideoCurationMedia.tsx, ProfileImageSlot.tsx). The card that
 *    opens this modal stays fully, unconditionally clickable regardless of
 *    which branch renders — see VideoCurationCard.tsx.
 *
 * Accessibility (dialog pattern, WAI-ARIA APG "Dialog (Modal)") — carried
 * over unchanged from the previous version, the client's explicit
 * non-regression requirement (item 22):
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing at
 *    the visible title.
 *  - Rendered through a portal to `document.body` so it always sits above
 *    every ancestor's stacking/overflow context (the rail it's triggered
 *    from has its own `overflow-x-auto` clipping box) and is never mounted
 *    during SSR (no `document` on the server — see the guard below), so
 *    there's no hydration mismatch.
 *  - Focus moves to the close button on open, is trapped inside the dialog
 *    while it's open (Tab/Shift+Tab cycle — Escape and the close button
 *    always provide a way out, so this isn't a WCAG 2.1.2 keyboard trap),
 *    and returns to whatever card triggered it on close.
 *  - Escape closes on desktop; so does a click on the dark backdrop
 *    (`stopPropagation` on the panel itself keeps a click inside the panel
 *    from bubbling to the backdrop's handler). ArrowLeft/ArrowRight move
 *    to the previous/next curation when navigation is available.
 *  - `document.body` scroll is locked while open and restored on close —
 *    the background never scrolls, and closing returns the rail to
 *    whatever scroll position it already had (nothing here moves it).
 */
export function VideoCurationModal({
  curation,
  onClose,
  onPrev,
  onNext,
  index,
  total,
}: {
  curation: VideoCuration | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  index?: number;
  total?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // HOMEPAGE ADMIN REBUILD — multi-clip support: when a showcase card
  // carries more than one real video (`curation.clips`), the viewer can
  // switch between them without closing the modal. `clipIndex` resets to
  // the first clip whenever a different card is opened (keyed off
  // `curation?.id` below), so leaving the modal open while paging between
  // cards (`onPrev`/`onNext`) never leaves a stale clip selected on the
  // next card.
  //
  // VIDEO SHOWCASE FIX: the selection is the playlist ENTRY ID (which embeds
  // the card id), not an index. An index is shared meaning across cards
  // ("3rd video" of whichever card is open) and can point past the end of a
  // shorter card; an id only ever matches an entry of its own card, so a
  // selection can never carry over to a different card. The gallery also
  // re-mounts this component per card (key={card.id}), so nothing else here
  // survives a card change either.
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  // VIDEO SHOWCASE FIX — set once a <video> element actually fails to
  // load (wrong/expired/unreachable file). An <iframe> can't be observed
  // the same way (a cross-origin page that refuses to be framed doesn't
  // fire a DOM error event here), which is exactly why every non-file
  // external embed below is paired with a visible "Open video" link
  // instead of relying on this flag.
  const [mediaFailed, setMediaFailed] = useState(false);
  // Adjust-during-render (not a useEffect — see useDraftSave.ts's matching
  // comment for why) so switching to a different card, or a different
  // clip within the same card, always starts from a clean error state and
  // (for a card change) its first clip, without an extra commit/render
  // pass.
  const playlist = useMemo(() => (curation ? buildPlaylist(curation) : []), [curation]);
  const activeEntry = resolveActiveEntry(playlist, selectedEntryId);
  const mediaKey = curation ? `${activeEntry?.id ?? `${curation.id}::none`}|${activeEntry?.videoUrl ?? ""}|${activeEntry?.externalUrl ?? ""}` : null;
  const [lastMediaKey, setLastMediaKey] = useState(mediaKey);
  if (mediaKey !== lastMediaKey) {
    setLastMediaKey(mediaKey);
    if (mediaFailed) setMediaFailed(false);
  }

  // Previous/Next move through THIS card's own videos whenever it has more
  // than one. Only a card with a single video (or none) keeps the older
  // "go to the neighbouring card" behaviour, so the arrows never mean two
  // different things on the same card.
  const hasPlaylistNav = playlist.length > 1;
  const activeId = activeEntry?.id ?? null;
  const goPrev = hasPlaylistNav ? () => setSelectedEntryId(stepPlaylist(playlist, activeId, -1)) : onPrev;
  const goNext = hasPlaylistNav ? () => setSelectedEntryId(stepPlaylist(playlist, activeId, 1)) : onNext;
  // The keyboard listener below is attached once per open card; it reads the
  // latest handlers through this ref so stepping videos never re-runs the
  // effect (which would move focus around).
  const navRef = useRef<{ prev?: () => void; next?: () => void }>({});
  useEffect(() => {
    navRef.current = { prev: goPrev, next: goNext };
  });

  useEffect(() => {
    if (!curation) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && navRef.current.prev) {
        e.stopPropagation();
        navRef.current.prev();
        return;
      }
      if (e.key === "ArrowRight" && navRef.current.next) {
        e.stopPropagation();
        navRef.current.next();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), video, iframe, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [curation, onClose]);

  if (!curation || typeof document === "undefined") return null;

  const titleId = `video-modal-title-${curation.id}`;
  // Progress segments: one per VIDEO of this card when it has a playlist,
  // otherwise one per card (the older behaviour for single-video cards).
  const activeIndex = Math.max(0, playlist.findIndex((e) => e.id === activeEntry?.id));
  const showProgress = hasPlaylistNav || (total != null && total > 1 && index != null);
  const progressCount = hasPlaylistNav ? playlist.length : (total ?? 0);
  const progressIndex = hasPlaylistNav ? activeIndex : index;

  // HOMEPAGE ADMIN REBUILD — multi-clip support: `clips` (when present and
  // non-empty) takes over playback from the card's own top-level
  // videoUrl/externalUrl/thumbnail, same as the type's own doc comment
  // describes. A single-clip or no-clips card falls through to exactly the
  // original fields/branching below — zero behavior change for every
  // curation that doesn't use this feature.
  const activeVideoUrl = activeEntry?.videoUrl ?? null;
  const activeExternalUrl = activeEntry?.externalUrl ?? null;
  const activeTitle = activeEntry?.title || curation.title;
  const mediaElementKey = activeEntry?.id ?? `${curation.id}::none`;
  // The poster belongs to the video being shown: its own thumbnail, else THIS card's thumbnail -- never another card's.
  const posterUrl = activeEntry?.thumbnail ?? curation.thumbnail ?? undefined;

  // VIDEO SHOWCASE FIX — root cause of "YouTube URLs don't reliably play":
  // this used to drop `activeExternalUrl` straight into an <iframe> src,
  // which only works for a URL that is already an embeddable path. A
  // YouTube watch/Shorts/youtu.be link is not one (YouTube only allows
  // framing its own "/embed/<id>" URL), so it rendered blank or got
  // refused outright. `resolveVideoEmbed` (src/lib/video/embed.ts) is the
  // single place that now decides, for every external link on this site,
  // whether it's YouTube (-> build a real embed URL), a direct media file
  // (-> play it with a native <video>, not an <iframe>), or something else
  // (-> best-effort <iframe>, always paired with a visible "Open video"
  // link below since a page that refuses to be framed fails silently from
  // here). An uploaded file (`activeVideoUrl`) always wins over any
  // external link, unchanged from before.
  const externalEmbed = !activeVideoUrl ? resolveVideoEmbed(activeExternalUrl) : null;
  const externalUrlLooksInvalid = !activeVideoUrl && Boolean(activeExternalUrl) && externalEmbed === null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[94vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-neutral-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {showProgress && (
          <div className="absolute inset-x-3 top-3 z-10 flex items-center gap-1 pr-11">
            {Array.from({ length: progressCount }).map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === progressIndex ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        )}

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>

        {/*
          Height-driven, not width-driven: `h-[min(78vh,640px)]` sets the
          media panel's height first, and `aspect-[9/16]` derives its width
          from that — the opposite of the old `aspect-video` panel, which
          set width first (`max-w-3xl`) and derived a landscape height. This
          is what keeps a genuinely tall/vertical viewer correctly sized on
          both a short mobile viewport and a tall desktop one, rather than
          overflowing or shrinking to a sliver on either.
        */}
        <div
          className="relative mx-auto aspect-[9/16] h-[min(78vh,640px)] w-auto shrink-0 bg-black"
          data-active-entry={activeEntry?.id ?? ""}
        >
          {mediaFailed ? (
            // A real <video> element fired an error event — an uploaded
            // file that's missing/corrupt, or a direct external file URL
            // that's unreachable. Never a silent black box: say so, and
            // offer the original link when there is one to open.
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-neutral-900 to-neutral-950 px-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300">
                <Icon name="film" className="h-7 w-7" />
              </span>
              <p className="text-sm font-semibold uppercase tracking-wide text-white/60">
                This video could not be played
              </p>
              <p className="max-w-[220px] text-xs text-white/40">
                The file may be missing or temporarily unreachable.
              </p>
              {externalEmbed?.originalUrl && (
                <a
                  href={externalEmbed.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Open video directly ↗
                </a>
              )}
            </div>
          ) : activeVideoUrl ? (
            <video
              key={mediaElementKey}
              src={activeVideoUrl}
              controls
              autoPlay
              poster={posterUrl}
              className="h-full w-full object-contain"
              onError={() => setMediaFailed(true)}
            >
              Your browser does not support embedded video.
            </video>
          ) : externalEmbed?.kind === "file" ? (
            // A direct external media file (e.g. a bare .mp4 link, not
            // uploaded) — plays through a native <video>, same as an
            // uploaded file, instead of the old behavior of dropping it
            // into an <iframe> (inconsistent/broken for raw media URLs).
            <video
              key={mediaElementKey}
              src={externalEmbed.embedUrl}
              controls
              autoPlay
              poster={posterUrl}
              className="h-full w-full object-contain"
              onError={() => setMediaFailed(true)}
            >
              Your browser does not support embedded video.
            </video>
          ) : externalEmbed ? (
            // YouTube ("kind: youtube", now a real /embed/<id> URL) or an
            // unrecognized external link ("kind: generic", best-effort).
            // A cross-origin page that refuses to be framed fails
            // silently (no DOM error event reaches this component), which
            // is exactly why the fallback link below is always shown
            // alongside the iframe rather than only after a detected
            // failure.
            <>
              <iframe
                key={mediaElementKey}
                src={externalEmbed.embedUrl}
                title={activeTitle}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <a
                href={externalEmbed.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-sm hover:bg-black/80 hover:text-white"
              >
                Can&rsquo;t see the video? Open it directly ↗
              </a>
            </>
          ) : externalUrlLooksInvalid ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-neutral-900 to-neutral-950 px-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300">
                <Icon name="film" className="h-7 w-7" />
              </span>
              <p className="text-sm font-semibold uppercase tracking-wide text-white/60">Video link isn&rsquo;t valid</p>
              <p className="max-w-[220px] text-xs text-white/40">
                The link saved for this video doesn&rsquo;t look like a working video URL.
              </p>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-neutral-900 to-neutral-950 px-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white">
                <Icon name="film" className="h-7 w-7" />
              </span>
              <p className="text-sm font-semibold uppercase tracking-wide text-white/60">
                Video coming soon
              </p>
              <p className="max-w-[220px] text-xs text-white/40">
                This curation is ready for the Admin Panel to add real
                footage — nothing fake is shown in its place.
              </p>
            </div>
          )}

          {goPrev && (
            <button
              type="button"
              onClick={goPrev}
              data-testid="player-prev"
              aria-label={hasPlaylistNav ? "Previous video" : "Previous showcase"}
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Icon name="chevron-left" className="h-5 w-5" />
            </button>
          )}
          {goNext && (
            <button
              type="button"
              onClick={goNext}
              data-testid="player-next"
              aria-label={hasPlaylistNav ? "Next video" : "Next showcase"}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Icon name="chevron-right" className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          <h2 id={titleId} className="text-base font-bold text-white sm:text-lg">
            {curation.title}
          </h2>
          {curation.description && (
            <p className="mt-1 text-sm text-white/70">{curation.description}</p>
          )}

          {/*
            Playlist position for a card that holds more than one video.
            There is deliberately NO row of per-clip thumbnails/icons: the
            single player above is stepped with Previous/Next, which only
            ever walk THIS card's own list (see stepPlaylist).
          */}
          {hasPlaylistNav && (
            <div className="mt-3" data-testid="playlist-status">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Video {activeIndex + 1} of {playlist.length}
              </p>
              {activeEntry?.kind === "clip" && activeEntry.title && activeEntry.title !== curation.title && (
                <p className="mt-1 text-sm font-medium text-white">{activeEntry.title}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

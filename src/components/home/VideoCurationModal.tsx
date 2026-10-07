"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { VideoCuration } from "@/types";
import { Icon } from "@/lib/icons";

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
  const [clipIndex, setClipIndex] = useState(0);
  // Adjust-during-render (not a useEffect — see useDraftSave.ts's matching
  // comment for why) so switching to a different card always starts on
  // its first clip, without an extra commit/render pass.
  const [lastCurationId, setLastCurationId] = useState(curation?.id);
  if (curation?.id !== lastCurationId) {
    setLastCurationId(curation?.id);
    setClipIndex(0);
  }

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
      if (e.key === "ArrowLeft" && onPrev) {
        e.stopPropagation();
        onPrev();
        return;
      }
      if (e.key === "ArrowRight" && onNext) {
        e.stopPropagation();
        onNext();
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
  }, [curation, onClose, onPrev, onNext]);

  if (!curation || typeof document === "undefined") return null;

  const titleId = `video-modal-title-${curation.id}`;
  const showProgress = total != null && total > 1 && index != null;

  // HOMEPAGE ADMIN REBUILD — multi-clip support: `clips` (when present and
  // non-empty) takes over playback from the card's own top-level
  // videoUrl/externalUrl/thumbnail, same as the type's own doc comment
  // describes. A single-clip or no-clips card falls through to exactly the
  // original fields/branching below — zero behavior change for every
  // curation that doesn't use this feature.
  const hasClips = Array.isArray(curation.clips) && curation.clips.length > 0;
  const activeClip = hasClips ? curation.clips![Math.min(clipIndex, curation.clips!.length - 1)] : null;
  const activeVideoUrl = activeClip ? activeClip.videoUrl ?? null : curation.videoUrl;
  const activeExternalUrl = activeClip ? activeClip.externalUrl ?? null : curation.externalUrl ?? null;
  const activeTitle = activeClip?.title || curation.title;

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
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === index ? "bg-white" : "bg-white/30"
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
        <div className="relative mx-auto aspect-[9/16] h-[min(78vh,640px)] w-auto shrink-0 bg-black">
          {activeVideoUrl ? (
            <video
              key={`${curation.id}-${clipIndex}`}
              src={activeVideoUrl}
              controls
              autoPlay
              className="h-full w-full object-contain"
            >
              Your browser does not support embedded video.
            </video>
          ) : activeExternalUrl ? (
            <iframe
              key={`${curation.id}-${clipIndex}`}
              src={activeExternalUrl}
              title={activeTitle}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-neutral-900 to-neutral-950 px-6 text-center">
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

          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous video"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Icon name="chevron-left" className="h-5 w-5" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Next video"
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
            HOMEPAGE ADMIN REBUILD — multi-clip switcher. Only rendered
            when this showcase item actually carries more than one real
            video; a single-clip (or no-clips) card shows none of this,
            unchanged from before. Each thumbnail is a plain button (not a
            link/video element) so it never fights the player's own
            focus/keyboard handling above.
          */}
          {hasClips && curation.clips!.length > 1 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                {curation.clips!.length} videos in this showcase
              </p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {curation.clips!.map((clip, i) => {
                  const poster = clip.thumbnail || curation.thumbnail;
                  return (
                    <button
                      key={clip.id || i}
                      type="button"
                      onClick={() => setClipIndex(i)}
                      aria-label={`Play clip ${i + 1}: ${clip.title || curation.title}`}
                      aria-current={i === clipIndex}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition-colors ${
                        i === clipIndex ? "ring-white" : "ring-white/15 hover:ring-white/40"
                      }`}
                    >
                      {poster ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small clip-picker thumbnail
                        <img src={poster} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-neutral-800 text-white/60">
                          <Icon name="film" className="h-4 w-4" />
                        </span>
                      )}
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">
                        {i + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
              {activeClip?.title && activeClip.title !== curation.title && (
                <p className="mt-2 text-sm font-medium text-white">{activeClip.title}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

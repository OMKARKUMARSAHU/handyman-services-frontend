"use client";

import { useEffect, useRef } from "react";
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
          {curation.videoUrl ? (
            <video
              key={curation.id}
              src={curation.videoUrl}
              controls
              autoPlay
              className="h-full w-full object-contain"
            >
              Your browser does not support embedded video.
            </video>
          ) : curation.externalUrl ? (
            <iframe
              key={curation.id}
              src={curation.externalUrl}
              title={curation.title}
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
        </div>
      </div>
    </div>,
    document.body
  );
}

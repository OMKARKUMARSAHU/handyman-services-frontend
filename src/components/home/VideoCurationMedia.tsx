"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";

/**
 * Poster/thumbnail media for one Video Curation card (Phase 3 revision —
 * "Video Curations" section; visual pass, "ACTUAL VIDEO MEDIA ASSETS"
 * round). Same server-checked-existence + client `onError` pattern used
 * everywhere else in this project for an optional, not-yet-supplied image
 * (see ProfileImageSlot.tsx's doc comment for the full race-condition
 * rationale): `thumbnailExists` is a filesystem fact checked server-side by
 * VideoCurationCard, so the fallback panel is what gets server-rendered in
 * the first place — nothing to swap client-side — and `onError` stays as a
 * second line of defense for a file that exists at build time but fails to
 * load at runtime.
 *
 * This round connected each curation to one of the project's existing,
 * original, generated product/context illustrations (the same
 * `scripts/gen_illustrations.mjs` assets already used in every service
 * gallery — see `video-curations.json`) as the poster, since no real
 * footage or photography exists yet and none was fabricated. The `failed`
 * fallback below (no thumbnail set, or a set one that 404s/errors) is the
 * true "nothing available" state and is styled as its own deliberate,
 * on-brand design — a soft radial brand-teal glow behind a ringed icon
 * badge, not a blank gray box — so an empty slot still reads as
 * intentional rather than a missing asset.
 *
 * The play-button badge always renders on top, whether the poster is a
 * real illustration or the true empty-state fallback — it's the honest
 * affordance for "this is a video." Post-QA Revision 2: every card now
 * opens `VideoCurationModal` on click regardless of poster or media state
 * (see VideoCurationCard.tsx) — what used to gate "is this card
 * clickable at all" on `videoUrl`/`externalUrl` now happens one level
 * deeper, inside the modal, which shows an honest "coming soon" state
 * instead of refusing to open.
 */
export function VideoCurationMedia({
  thumbnail,
  thumbnailExists,
  alt,
}: {
  thumbnail: string | null;
  thumbnailExists: boolean;
  alt: string;
}) {
  const [failed, setFailed] = useState(!thumbnail || !thumbnailExists);

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-neutral-100">
      {failed || !thumbnail ? (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200">
          {/* Soft brand-teal glow + a faint dot texture — a deliberate "footage coming soon" design, not a placeholder gray box. */}
          <div className="absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-brand-600/15 blur-2xl" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
              backgroundSize: "14px 14px",
              color: "#1f7267",
            }}
          />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-brand-600/20 bg-white text-brand-600 shadow-sm">
            <Icon name="film" className="h-6 w-6" />
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- original in-house illustration asset, existence already checked server-side
        <img
          src={thumbnail}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/10" />

      {/*
        A center vignette, independent of the bottom title-legibility
        gradient above: the product illustrations (like every illustration
        in this project) center their icon exactly where a centered play
        button also sits, and the two competed visually in review — a
        teal shield/box icon fighting a white play circle for the same
        spot. This softly dims the middle so the play button reads as the
        clear focal point while the illustration still shows through at
        the edges/corners.
      */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.5)_0%,rgba(0,0,0,0.15)_38%,rgba(0,0,0,0)_62%)]" />

      {/*
        Post-QA Revision 2: enlarged from h-12/icon-5 to a genuinely "large
        centered play button" per the client's explicit requirement — the
        card itself grew (220/260/300px vs. the previous 160/190px), so a
        proportionally larger affordance keeps it reading as the clear
        primary action rather than shrinking into the bigger card.
      */}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 sm:h-16 sm:w-16">
          <Icon name="play" className="h-6 w-6 translate-x-0.5 text-brand-700 sm:h-7 sm:w-7" />
        </span>
      </span>
    </div>
  );
}

import type { VideoCuration, VideoCurationClip } from "../../types";

/**
 * What a Video Showcase card actually plays.
 *
 * A card's playlist is its OWN main video (when it has one) followed by its
 * OWN additional clips, in order -- nothing else. It is rebuilt from the
 * card passed in, and each entry id includes the card id, so a selection
 * made on one card can never match an entry on another card.
 *
 * Previously the public player played only `clips` whenever a card had any
 * and silently dropped the card's main video, while the admin counted and
 * described "main video + clips". The two disagreed, so a main video that
 * was removed/replaced in the admin could appear to "stick" (or a main video
 * that was set never showed). One shared function now defines the list for
 * the player, the card badge and the tests.
 */

export interface PlaylistEntry {
  /** Unique across ALL cards: `<cardId>::main` or `<cardId>::clip::<clipId>`. */
  id: string;
  kind: "main" | "clip";
  title: string | null;
  videoUrl: string | null;
  externalUrl: string | null;
  thumbnail: string | null;
}

/** Trims; treats "", "null" and "undefined" (what String(null) would have produced) as "no value". */
export function cleanUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
}

export function hasPlayableSource(src: { videoUrl?: unknown; externalUrl?: unknown }): boolean {
  return cleanUrl(src.videoUrl) !== null || cleanUrl(src.externalUrl) !== null;
}

function clipEntry(cardId: string, clip: VideoCurationClip, index: number): PlaylistEntry {
  return {
    id: `${cardId}::clip::${clip.id || index}`,
    kind: "clip",
    title: clip.title ?? null,
    videoUrl: cleanUrl(clip.videoUrl),
    externalUrl: cleanUrl(clip.externalUrl),
    thumbnail: cleanUrl(clip.thumbnail),
  };
}

export function buildPlaylist(curation: Pick<VideoCuration, "id" | "title" | "videoUrl" | "externalUrl" | "thumbnail" | "clips">): PlaylistEntry[] {
  const entries: PlaylistEntry[] = [];
  if (hasPlayableSource(curation)) {
    entries.push({
      id: `${curation.id}::main`,
      kind: "main",
      title: curation.title,
      videoUrl: cleanUrl(curation.videoUrl),
      externalUrl: cleanUrl(curation.externalUrl),
      thumbnail: cleanUrl(curation.thumbnail),
    });
  }
  (curation.clips ?? []).forEach((clip, i) => {
    if (hasPlayableSource(clip)) entries.push(clipEntry(curation.id, clip, i));
  });
  return entries;
}

/** The selected entry if it belongs to this playlist, otherwise the first one (or null for an empty card -> "Video coming soon"). */
export function resolveActiveEntry(playlist: PlaylistEntry[], selectedId: string | null): PlaylistEntry | null {
  if (selectedId) {
    const hit = playlist.find((e) => e.id === selectedId);
    if (hit) return hit;
  }
  return playlist[0] ?? null;
}

/**
 * Move through ONE card's playlist. `delta` is +1 (next) / -1 (previous) and
 * wraps around inside that same playlist -- it can never land on an entry of
 * another card because it only ever looks at the list it is given.
 * Returns the id of the entry to play, or null for an empty playlist.
 */
export function stepPlaylist(playlist: PlaylistEntry[], activeId: string | null, delta: number): string | null {
  if (playlist.length === 0) return null;
  const current = Math.max(0, playlist.findIndex((e) => e.id === activeId));
  const next = (((current + delta) % playlist.length) + playlist.length) % playlist.length;
  return playlist[next].id;
}

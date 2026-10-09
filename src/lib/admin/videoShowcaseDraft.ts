import type { HomepageSectionItem, HomepageSectionItemClip } from "./content-api";
import { makeUniqueId } from "../video/identity";
import { cleanUrl } from "../video/playlist";

/**
 * Pure draft <-> stored-item mapping for the Video Showcase admin editor.
 * Kept out of the React component so the exact same code is what the
 * regression tests exercise (see scripts/verify-video-showcase/).
 */

export interface VideoClipDraft {
  id: string;
  title: string;
  videoUrl: string | null;
  externalUrl: string;
  thumbnail: string | null;
  durationSeconds: string;
}

export interface VideoCurationDraft {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  serviceTypeId: string;
  thumbnail: string | null;
  videoUrl: string | null;
  externalUrl: string;
  durationSeconds: string;
  active: boolean;
  /**
   * "Delete" only flags the card in the unsaved editor state; nothing is
   * removed from the database until the admin confirms and saves. Separate
   * from `active` on purpose (hiding vs deleting).
   */
  markedForDeletion: boolean;
  clips: VideoClipDraft[];
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function clipItemToDraft(raw: HomepageSectionItemClip, id: string): VideoClipDraft {
  return {
    id,
    title: text(raw.title),
    videoUrl: cleanUrl(raw.videoUrl),
    externalUrl: text(raw.externalUrl),
    thumbnail: cleanUrl(raw.thumbnail),
    durationSeconds: text(raw.durationSeconds),
  };
}

/**
 * Stored items -> editor drafts. Deterministic: the same input always gives
 * the same output (including repaired ids), because the editor calls this on
 * every render to detect server-side changes.
 */
export function toVideoDraftList(items: HomepageSectionItem[] | null | undefined): VideoCurationDraft[] {
  if (!items) return [];
  const seenCardIds = new Set<string>();
  // Clip ids are unique across the WHOLE list, not just inside one card, so a clip id can never name two clips.
  const seenClipIds = new Set<string>();
  return items.map((it, cardIndex) => {
    const cardId = makeUniqueId(it.id, `video-card-${cardIndex + 1}`, seenCardIds);
    const rawClips = Array.isArray(it.clips) ? it.clips : [];
    return {
      id: cardId,
      title: text(it.title),
      description: text(it.description),
      categoryId: text(it.categoryId),
      serviceTypeId: text(it.serviceTypeId),
      thumbnail: cleanUrl(it.thumbnail),
      videoUrl: cleanUrl(it.videoUrl),
      externalUrl: text(it.externalUrl),
      durationSeconds: text(it.durationSeconds),
      active: it.active === undefined || Number(it.active) === 1,
      markedForDeletion: false,
      clips: rawClips.map((c, clipIndex) =>
        clipItemToDraft(c, makeUniqueId(c.id, `${cardId}-clip-${clipIndex + 1}`, seenClipIds))
      ),
    };
  });
}

/**
 * Editor drafts -> the list that gets saved. Cards flagged for deletion are
 * left out (that IS the delete: a card and its clips live inside one list
 * item), remaining cards are renumbered, and an emptied field is OMITTED, not
 * kept -- the backend replaces the whole list, so an omitted key is removed
 * from the stored card and can never come back from an old value.
 */
export function buildVideoSavePayload(drafts: VideoCurationDraft[]): HomepageSectionItem[] {
  return drafts
    .filter((card) => !card.markedForDeletion)
    .map((card, idx) => {
      const out: HomepageSectionItem = { id: card.id, title: card.title, sortOrder: idx, active: card.active ? 1 : 0 };
      if (card.description) out.description = card.description;
      if (card.categoryId) out.categoryId = card.categoryId;
      if (card.serviceTypeId) out.serviceTypeId = card.serviceTypeId;
      const thumbnail = cleanUrl(card.thumbnail);
      if (thumbnail) out.thumbnail = thumbnail;
      const videoUrl = cleanUrl(card.videoUrl);
      if (videoUrl) out.videoUrl = videoUrl;
      const externalUrl = cleanUrl(card.externalUrl);
      if (externalUrl) out.externalUrl = externalUrl;
      if (card.durationSeconds) out.durationSeconds = Number(card.durationSeconds);
      if (card.clips.length > 0) {
        out.clips = card.clips.map((clip) => {
          const c: HomepageSectionItemClip = { id: clip.id };
          if (clip.title) c.title = clip.title;
          const clipVideo = cleanUrl(clip.videoUrl);
          if (clipVideo) c.videoUrl = clipVideo;
          const clipExternal = cleanUrl(clip.externalUrl);
          if (clipExternal) c.externalUrl = clipExternal;
          const clipThumb = cleanUrl(clip.thumbnail);
          if (clipThumb) c.thumbnail = clipThumb;
          if (clip.durationSeconds) c.durationSeconds = Number(clip.durationSeconds);
          return c;
        });
      }
      return out;
    });
}

/** How many playable videos this card has: its main video (if set) plus each clip with a source. */
export function countPlayableVideos(card: Pick<VideoCurationDraft, "videoUrl" | "externalUrl" | "clips">): number {
  const hasMain = cleanUrl(card.videoUrl) !== null || cleanUrl(card.externalUrl) !== null;
  const clips = card.clips.filter((c) => cleanUrl(c.videoUrl) !== null || cleanUrl(c.externalUrl) !== null).length;
  return (hasMain ? 1 : 0) + clips;
}

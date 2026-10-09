import { getDb } from "../../database/db";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import { toHomepageSectionDto, type HomepageSectionDto, type HomepageSectionItem, type HomepageSectionRow } from "./homepageSections.types";

const TABLE = "homepage_sections";

export async function listHomepageSections(): Promise<HomepageSectionDto[]> {
  const rows = await getDb()<HomepageSectionRow>(TABLE).orderBy("sort_order", "asc");
  return rows.map(toHomepageSectionDto);
}

/** Sections whose `items` carry a per-item `active` flag that the public site must honor server-side. */
const VIDEO_SECTION_KEY = "video-curations";
const SECTIONS_WITH_ACTIVE_ITEMS = new Set([VIDEO_SECTION_KEY]);

/**
 * An item is inactive only when its `active` flag is explicitly falsy
 * (0, "0", "false" or false). A missing flag means active, so data saved
 * before the flag existed stays visible. This is deliberately independent
 * of whether the item has a video file.
 */
function isItemInactive(item: HomepageSectionItem): boolean {
  const flag = (item as Record<string, unknown>).active;
  if (flag === undefined || flag === null) return false;
  if (typeof flag === "string") return flag === "0" || flag.toLowerCase() === "false";
  return Number(flag) === 0 || flag === false;
}

/**
 * Public read: same as the admin list, but inactive items of sections that
 * use per-item activation are removed *here*, so an inactive card's title,
 * video URL and clips are never sent to the browser at all.
 */
export async function listPublicHomepageSections(): Promise<HomepageSectionDto[]> {
  const sections = await listHomepageSections();
  return sections.map((section) =>
    SECTIONS_WITH_ACTIVE_ITEMS.has(section.key) && section.items
      ? { ...section, items: section.items.filter((item) => !isItemInactive(item)) }
      : section
  );
}

/**
 * Video Showcase cards and clips are addressed by `id` everywhere (admin
 * editor, public player, tests). Two cards sharing an id, or a card with no
 * id, would make "edit/delete THIS card" ambiguous -- so the backend refuses
 * to store such a list instead of letting one card's video appear on (or be
 * deleted with) another. Clip ids are unique across the WHOLE list (not just inside one card), so an id can never name clips of two different cards.
 */
export function assertValidVideoCurationItems(items: HomepageSectionItem[] | null | undefined): void {
  if (!items) return;
  const cardIds = new Set<string>();
  const allClipIds = new Map<string, string>(); // clip id -> owning card id
  items.forEach((item, index) => {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id) throw new ValidationError(`Video showcase card #${index + 1} has no id.`);
    if (cardIds.has(id)) throw new ValidationError(`Two video showcase cards share the id "${id}". Every card needs its own id.`);
    cardIds.add(id);
    const clips = Array.isArray(item.clips) ? item.clips : [];
    clips.forEach((clip, clipIndex) => {
      const clipId = typeof clip.id === "string" ? clip.id.trim() : "";
      if (!clipId) throw new ValidationError(`Clip #${clipIndex + 1} of card "${id}" has no id.`);
      const owner = allClipIds.get(clipId);
      if (owner === id) throw new ValidationError(`Card "${id}" has two clips with the id "${clipId}".`);
      if (owner !== undefined) throw new ValidationError(`Clip id "${clipId}" is used by both card "${owner}" and card "${id}". Every clip needs its own id.`);
      allClipIds.set(clipId, id);
    });
  });
}

export interface UpsertHomepageSectionInput {
  key: string;
  heading: string;
  subheading?: string | null;
  body?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  items?: HomepageSectionItem[] | null;
  sortOrder?: number;
  image?: string | null;
  imageAlt?: string | null;
}

/** `key` is a stable, admin-chosen slug (e.g. "hero", "why-choose-us") — never auto-generated, since the frontend's homepage template looks sections up by this exact key. */
export async function createHomepageSection(input: UpsertHomepageSectionInput): Promise<HomepageSectionDto> {
  if (input.key === VIDEO_SECTION_KEY) assertValidVideoCurationItems(input.items);
  const existing = await getDb()<HomepageSectionRow>(TABLE).where({ key: input.key }).first();
  if (existing) throw new ConflictError(`A homepage section with key "${input.key}" already exists.`);

  await getDb()<HomepageSectionRow>(TABLE).insert({
    key: input.key,
    heading: input.heading,
    subheading: input.subheading ?? null,
    body: input.body ?? null,
    cta_text: input.ctaText ?? null,
    cta_link: input.ctaLink ?? null,
    items: input.items ? JSON.stringify(input.items) : null,
    sort_order: input.sortOrder ?? 0,
    image: input.image ?? null,
    image_alt: input.imageAlt ?? null,
  } as unknown as HomepageSectionRow);
  const row = await getDb()<HomepageSectionRow>(TABLE).where({ key: input.key }).first();
  return toHomepageSectionDto(row!);
}

export async function updateHomepageSection(
  key: string,
  input: Partial<Omit<UpsertHomepageSectionInput, "key">>
): Promise<HomepageSectionDto> {
  if (key === VIDEO_SECTION_KEY) assertValidVideoCurationItems(input.items);
  const existing = await getDb()<HomepageSectionRow>(TABLE).where({ key }).first();
  if (!existing) throw new NotFoundError("Homepage section not found.");

  const patch: Partial<HomepageSectionRow> = {};
  if (input.heading !== undefined) patch.heading = input.heading;
  if (input.subheading !== undefined) patch.subheading = input.subheading;
  if (input.body !== undefined) patch.body = input.body;
  if (input.ctaText !== undefined) patch.cta_text = input.ctaText;
  if (input.ctaLink !== undefined) patch.cta_link = input.ctaLink;
  if (input.items !== undefined) patch.items = input.items ? (JSON.stringify(input.items) as unknown as string) : null;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.image !== undefined) patch.image = input.image;
  if (input.imageAlt !== undefined) patch.image_alt = input.imageAlt;

  if (Object.keys(patch).length > 0) {
    await getDb()<HomepageSectionRow>(TABLE).where({ key }).update(patch);
  }
  const row = await getDb()<HomepageSectionRow>(TABLE).where({ key }).first();
  return toHomepageSectionDto(row!);
}

export async function deleteHomepageSection(key: string): Promise<void> {
  const deleted = await getDb()<HomepageSectionRow>(TABLE).where({ key }).delete();
  if (!deleted) throw new NotFoundError("Homepage section not found.");
}

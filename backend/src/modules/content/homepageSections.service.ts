import { getDb } from "../../database/db";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { toHomepageSectionDto, type HomepageSectionDto, type HomepageSectionItem, type HomepageSectionRow } from "./homepageSections.types";

const TABLE = "homepage_sections";

export async function listHomepageSections(): Promise<HomepageSectionDto[]> {
  const rows = await getDb()<HomepageSectionRow>(TABLE).orderBy("sort_order", "asc");
  return rows.map(toHomepageSectionDto);
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

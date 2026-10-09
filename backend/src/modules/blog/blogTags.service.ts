import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { toBlogTagDto, type BlogTagDto, type BlogTagRow } from "./blog.types";

const TABLE = "blog_tags";

export async function listBlogTags(): Promise<BlogTagDto[]> {
  const rows = await getDb()<BlogTagRow>(TABLE).orderBy("name", "asc");
  return rows.map(toBlogTagDto);
}

export async function getBlogTagById(id: string): Promise<BlogTagDto | null> {
  const row = await getDb()<BlogTagRow>(TABLE).where({ id }).first();
  return row ? toBlogTagDto(row) : null;
}

export async function getBlogTagBySlug(slug: string): Promise<BlogTagDto | null> {
  const row = await getDb()<BlogTagRow>(TABLE).where({ slug }).first();
  return row ? toBlogTagDto(row) : null;
}

export interface UpsertBlogTagInput {
  slug: string;
  name: string;
}

export async function createBlogTag(input: UpsertBlogTagInput): Promise<BlogTagDto> {
  const existing = await getBlogTagBySlug(input.slug);
  if (existing) throw new ConflictError(`A blog tag with slug "${input.slug}" already exists.`);

  const id = randomUUID();
  await getDb()<BlogTagRow>(TABLE).insert({ id, slug: input.slug, name: input.name });
  const created = await getBlogTagById(id);
  if (!created) throw new Error("Failed to read back created blog tag.");
  return created;
}

export async function updateBlogTag(id: string, input: Partial<UpsertBlogTagInput>): Promise<BlogTagDto> {
  const existing = await getBlogTagById(id);
  if (!existing) throw new NotFoundError("Blog tag not found.");

  if (input.slug !== undefined && input.slug !== existing.slug) {
    const collision = await getBlogTagBySlug(input.slug);
    if (collision) throw new ConflictError(`A blog tag with slug "${input.slug}" already exists.`);
  }

  const patch: Partial<BlogTagRow> = {};
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.name !== undefined) patch.name = input.name;

  if (Object.keys(patch).length > 0) {
    await getDb()<BlogTagRow>(TABLE).where({ id }).update(patch);
  }
  const updated = await getBlogTagById(id);
  if (!updated) throw new Error("Failed to read back updated blog tag.");
  return updated;
}

/** No reference check needed here, unlike categories — `blog_post_tags` is `ON DELETE CASCADE` on the tag side, so removing a tag just detaches it from whatever posts had it rather than leaving anything orphaned or blocked. */
export async function deleteBlogTag(id: string): Promise<void> {
  const deleted = await getDb()<BlogTagRow>(TABLE).where({ id }).delete();
  if (!deleted) throw new NotFoundError("Blog tag not found.");
}

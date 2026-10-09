import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { toBlogCategoryDto, type BlogCategoryDto, type BlogCategoryRow } from "./blog.types";

const TABLE = "blog_categories";

/** `includeInactive` — same meaning as the identical option on `listCategories()`/`listCities()`. */
export async function listBlogCategories(opts: { includeInactive?: boolean } = {}): Promise<BlogCategoryDto[]> {
  let query = getDb()<BlogCategoryRow>(TABLE);
  if (!opts.includeInactive) query = query.where({ active: true });
  const rows = await query.orderBy("sort_order", "asc");
  return rows.map(toBlogCategoryDto);
}

export async function getBlogCategoryById(id: string): Promise<BlogCategoryDto | null> {
  const row = await getDb()<BlogCategoryRow>(TABLE).where({ id }).first();
  return row ? toBlogCategoryDto(row) : null;
}

export async function getBlogCategoryBySlug(slug: string): Promise<BlogCategoryDto | null> {
  const row = await getDb()<BlogCategoryRow>(TABLE).where({ slug }).first();
  return row ? toBlogCategoryDto(row) : null;
}

export interface UpsertBlogCategoryInput {
  slug: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export async function createBlogCategory(input: UpsertBlogCategoryInput): Promise<BlogCategoryDto> {
  const existing = await getBlogCategoryBySlug(input.slug);
  if (existing) throw new ConflictError(`A blog category with slug "${input.slug}" already exists.`);

  const id = randomUUID();
  await getDb()<BlogCategoryRow>(TABLE).insert({
    id,
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    sort_order: input.sortOrder ?? 0,
    active: input.active ?? true,
  });
  const created = await getBlogCategoryById(id);
  if (!created) throw new Error("Failed to read back created blog category.");
  return created;
}

export async function updateBlogCategory(
  id: string,
  input: Partial<UpsertBlogCategoryInput>
): Promise<BlogCategoryDto> {
  const existing = await getBlogCategoryById(id);
  if (!existing) throw new NotFoundError("Blog category not found.");

  if (input.slug !== undefined && input.slug !== existing.slug) {
    const collision = await getBlogCategoryBySlug(input.slug);
    if (collision) throw new ConflictError(`A blog category with slug "${input.slug}" already exists.`);
  }

  const patch: Partial<BlogCategoryRow> = {};
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.active !== undefined) patch.active = input.active;

  if (Object.keys(patch).length > 0) {
    await getDb()<BlogCategoryRow>(TABLE).where({ id }).update(patch);
  }
  const updated = await getBlogCategoryById(id);
  if (!updated) throw new Error("Failed to read back updated blog category.");
  return updated;
}

/**
 * Blocks deletion while any post still references this category (same
 * "can't silently orphan something that depends on this" philosophy as
 * `media-library.service.ts`'s `deleteMedia`) — the admin UI should offer
 * reassigning or deactivating instead. Unlike `products.category_id`
 * (storefront, `ON DELETE RESTRICT`), the FK itself is `SET NULL` so a
 * post is never blocked from being edited/saved by a category that later
 * disappears; this check only stops the category delete itself from
 * happening while posts still count on it.
 */
export async function deleteBlogCategory(id: string): Promise<void> {
  const existing = await getBlogCategoryById(id);
  if (!existing) throw new NotFoundError("Blog category not found.");

  const row = await getDb()("blog_posts").where({ category_id: id }).count<{ count: string }[]>({ count: "*" }).first();
  const count = Number(row?.count ?? 0);
  if (count > 0) {
    throw new ConflictError(
      `This category is used by ${count} post(s) and can't be deleted. Reassign those posts' category first, or deactivate it instead.`
    );
  }

  await getDb()(TABLE).where({ id }).delete();
}

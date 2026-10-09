import { randomUUID } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { getDb } from "../../database/db";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import { getBlogCategoryBySlug } from "./blogCategories.service";
import {
  toBlogCategoryDto,
  toBlogPostDto,
  toBlogPostSummaryDto,
  type BlogCategoryDto,
  type BlogCategoryRow,
  type BlogPostDto,
  type BlogPostHydrated,
  type BlogPostRow,
  type BlogPostStatus,
  type BlogPostSummaryDto,
  type BlogTagDto,
} from "./blog.types";

const TABLE = "blog_posts";
const JOIN_TABLE = "blog_post_tags";

// ---------------------------------------------------------------------------
// Rich content: sanitization + word-count stats
// ---------------------------------------------------------------------------

/**
 * Requirement 9 ("Sanitize rendered rich content ... to prevent XSS"),
 * applied on every write regardless of who/what produced the HTML. The
 * allow-list matches exactly what the admin rich-text editor (TipTap) is
 * configured to produce: formatting, lists, links, images, a restricted
 * `text-align` inline style (TipTap's TextAlign extension), and video via
 * either a direct upload (`<video>`) or a YouTube embed (`<iframe>`
 * restricted to `www.youtube.com` — the same embeddable-URL rule as
 * `src/lib/video/embed.ts` on the frontend, enforced again here server
 * -side since the backend can never trust the editor's own restraint).
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
    "img",
    "figure",
    "figcaption",
    "video",
    "iframe",
    "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    video: ["src", "controls", "width", "height", "poster", "preload"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
    "*": ["style", "class"],
  },
  allowedIframeHostnames: ["www.youtube.com"],
  allowedSchemes: ["http", "https"],
  allowedSchemesByTag: { img: ["http", "https"], video: ["http", "https"] },
  allowedStyles: {
    "*": { "text-align": [/^left$/, /^center$/, /^right$/, /^justify$/] },
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }, true),
  },
};

function sanitizeContent(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/** Plain-text word count + a 200-wpm reading-time estimate, computed once at save time (requirement 8) rather than re-parsed on every list/detail read. */
function computeWordStats(html: string): { wordCount: number; readingTimeMinutes: number } {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .trim();
  const words = text.length > 0 ? text.split(/\s+/) : [];
  const wordCount = words.length;
  const readingTimeMinutes = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0;
  return { wordCount, readingTimeMinutes };
}

// ---------------------------------------------------------------------------
// Scheduling: server-side timer (blogScheduler.ts) + read-time safety net
// ---------------------------------------------------------------------------

/**
 * Promotes every post still marked `scheduled` whose `published_at` has
 * passed to `published` in one idempotent UPDATE, and returns how many
 * rows it flipped.
 *
 * Two independent callers keep scheduled publishing reliable:
 *
 *  1. `blogScheduler.ts` -- a server-side interval started from
 *     `server.ts`, so a scheduled post goes live at (within one tick of)
 *     its target time even if no admin is logged in and no visitor opens
 *     the site. This is the primary mechanism.
 *  2. Every read path below also calls this first, as a safety net: if
 *     the process was down/restarting when a post came due, or a request
 *     lands between ticks, the stored `status` is still corrected before
 *     the query runs, so the sitemap/public list/admin list/admin detail
 *     can never disagree with each other.
 *
 * The UPDATE is idempotent (a second concurrent caller, or a second
 * Elastic Beanstalk instance, simply matches zero rows), so no leader
 * election/locking is needed.
 */
export async function promoteDueScheduledPosts(): Promise<number> {
  return getDb()<BlogPostRow>(TABLE)
    .where({ status: "scheduled" })
    .andWhere("published_at", "<=", new Date())
    .update({ status: "published" });
}

// ---------------------------------------------------------------------------
// Hydration: category / tags / media URLs for a batch of rows
// ---------------------------------------------------------------------------

async function hydrateMany(rows: BlogPostRow[]): Promise<Map<string, BlogPostHydrated>> {
  const result = new Map<string, BlogPostHydrated>();
  if (rows.length === 0) return result;

  const db = getDb();
  const categoryIds = [...new Set(rows.map((r) => r.category_id).filter((v): v is string => Boolean(v)))];
  const mediaIds = [
    ...new Set(
      rows.flatMap((r) => [r.featured_image_media_id, r.og_image_media_id]).filter((v): v is string => Boolean(v))
    ),
  ];
  const postIds = rows.map((r) => r.id);

  const [categories, media, tagRows] = await Promise.all([
    categoryIds.length ? db<BlogCategoryRow>("blog_categories").whereIn("id", categoryIds) : Promise.resolve([]),
    mediaIds.length
      ? db("media").whereIn("id", mediaIds).select<{ id: string; url: string }[]>("id", "url")
      : Promise.resolve([] as { id: string; url: string }[]),
    db(JOIN_TABLE)
      .whereIn("post_id", postIds)
      .join("blog_tags", "blog_tags.id", `${JOIN_TABLE}.tag_id`)
      .select<{ post_id: string; id: string; slug: string; name: string }[]>(
        `${JOIN_TABLE}.post_id as post_id`,
        "blog_tags.id as id",
        "blog_tags.slug as slug",
        "blog_tags.name as name"
      ),
  ]);

  const categoryById = new Map<string, BlogCategoryDto>(categories.map((c) => [c.id, toBlogCategoryDto(c)]));
  const mediaUrlById = new Map<string, string>(media.map((m) => [m.id, m.url]));
  const tagsByPostId = new Map<string, BlogTagDto[]>();
  for (const row of tagRows) {
    const list = tagsByPostId.get(row.post_id) ?? [];
    list.push({ id: row.id, slug: row.slug, name: row.name });
    tagsByPostId.set(row.post_id, list);
  }

  for (const row of rows) {
    result.set(row.id, {
      category: row.category_id ? categoryById.get(row.category_id) ?? null : null,
      tags: tagsByPostId.get(row.id) ?? [],
      featuredImageUrl: row.featured_image_media_id ? mediaUrlById.get(row.featured_image_media_id) ?? null : null,
      ogImageUrl: row.og_image_media_id ? mediaUrlById.get(row.og_image_media_id) ?? null : null,
    });
  }
  return result;
}

async function hydrateOne(row: BlogPostRow): Promise<BlogPostHydrated> {
  const map = await hydrateMany([row]);
  return map.get(row.id)!;
}

async function setPostTags(postId: string, tagIds: string[]): Promise<void> {
  const db = getDb();
  await db.transaction(async (trx) => {
    await trx(JOIN_TABLE).where({ post_id: postId }).delete();
    const uniqueIds = [...new Set(tagIds)];
    if (uniqueIds.length > 0) {
      await trx(JOIN_TABLE).insert(uniqueIds.map((tagId) => ({ post_id: postId, tag_id: tagId })));
    }
  });
}

/**
 * `published_at` is dual-purpose (see the migration's doc comment):
 * future target time while `scheduled`, actual go-live time once
 * `published`. This is the one place that decides what it should become
 * for a given status transition, shared by create and update so the rule
 * can't drift between the two.
 */
function resolvePublishedAt(
  status: BlogPostStatus,
  requested: string | null | undefined,
  existing: Date | string | null
): Date | null {
  if (status === "scheduled") {
    const target = requested !== undefined ? requested : existing ? new Date(existing).toISOString() : null;
    if (!target) throw new ValidationError("A publish date is required to schedule this post.");
    return new Date(target);
  }
  if (status === "published") {
    if (requested) return new Date(requested);
    // A still-future `existing` date means the post was `scheduled` and the
    // admin chose "Publish Now" -- it goes live now, not at the old target
    // time (which would leave a "published" post with a future date).
    if (existing && new Date(existing).getTime() <= Date.now()) return new Date(existing);
    return new Date();
  }
  // draft / archived — never synthesized; preserved as publish history
  // unless the caller explicitly changes it (so "unpublish" doesn't erase
  // when a post was previously live, but an explicit clear is honored).
  if (requested !== undefined) return requested ? new Date(requested) : null;
  return existing ? new Date(existing) : null;
}

// ---------------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------------

export interface AdminListBlogPostsParams {
  status?: BlogPostStatus;
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
  sort?: "newest" | "oldest" | "title";
  page?: number;
  pageSize?: number;
}

export async function listBlogPostsAdmin(
  params: AdminListBlogPostsParams
): Promise<{ items: BlogPostSummaryDto[]; total: number; page: number; pageSize: number }> {
  await promoteDueScheduledPosts();
  const db = getDb();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  let query = db<BlogPostRow>(TABLE);
  if (params.status) query = query.where({ status: params.status });
  if (params.categorySlug) {
    const category = await getBlogCategoryBySlug(params.categorySlug);
    query = query.where({ category_id: category?.id ?? "__none__" });
  }
  if (params.tagSlug) {
    query = query.whereIn(
      "id",
      db(JOIN_TABLE).join("blog_tags", "blog_tags.id", `${JOIN_TABLE}.tag_id`).where("blog_tags.slug", params.tagSlug).select(`${JOIN_TABLE}.post_id`)
    );
  }
  if (params.search) {
    const term = `%${params.search}%`;
    query = query.where((qb) => qb.whereILike("title", term).orWhereILike("excerpt", term));
  }

  const totalRow = await query.clone().count<{ count: string }[]>({ count: "*" }).first();
  const total = Number(totalRow?.count ?? 0);

  const orderCol = params.sort === "title" ? "title" : "created_at";
  const orderDir = params.sort === "oldest" || params.sort === "title" ? "asc" : "desc";

  const rows = await query
    .clone()
    .orderBy(orderCol, orderDir)
    .offset((page - 1) * pageSize)
    .limit(pageSize);
  const hydrated = await hydrateMany(rows);
  const items = rows.map((row) => toBlogPostSummaryDto(row, hydrated.get(row.id)!));
  return { items, total, page, pageSize };
}

export async function getBlogPostByIdAdmin(id: string): Promise<BlogPostDto> {
  await promoteDueScheduledPosts();
  const row = await getDb()<BlogPostRow>(TABLE).where({ id }).first();
  if (!row) throw new NotFoundError("Blog post not found.");
  return toBlogPostDto(row, await hydrateOne(row));
}

// ---------------------------------------------------------------------------
// Public reads — published only, never leaks drafts/scheduled/archived
// ---------------------------------------------------------------------------

export interface PublicListBlogPostsParams {
  categorySlug?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listBlogPostsPublic(
  params: PublicListBlogPostsParams
): Promise<{ items: BlogPostSummaryDto[]; total: number; page: number; pageSize: number }> {
  await promoteDueScheduledPosts();
  const db = getDb();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 9;

  let query = db<BlogPostRow>(TABLE).where({ status: "published" });
  if (params.categorySlug) {
    const category = await getBlogCategoryBySlug(params.categorySlug);
    query = query.where({ category_id: category?.id ?? "__none__" });
  }
  if (params.search) {
    const term = `%${params.search}%`;
    query = query.where((qb) => qb.whereILike("title", term).orWhereILike("excerpt", term));
  }

  const totalRow = await query.clone().count<{ count: string }[]>({ count: "*" }).first();
  const total = Number(totalRow?.count ?? 0);

  const rows = await query
    .clone()
    .orderBy("published_at", "desc")
    .offset((page - 1) * pageSize)
    .limit(pageSize);
  const hydrated = await hydrateMany(rows);
  const items = rows.map((row) => toBlogPostSummaryDto(row, hydrated.get(row.id)!));
  return { items, total, page, pageSize };
}

/**
 * Every eligible published post's slug — used by `src/app/sitemap.ts` on
 * the frontend. Deliberately separate from `listBlogPostsPublic` (no
 * pagination, no hydration, just slug + updatedAt) so the sitemap never
 * has to page through the public list endpoint to enumerate every URL.
 */
export async function listPublishedBlogPostSlugsForSitemap(): Promise<
  Array<{ slug: string; updatedAt: string; publishedAt: string | null }>
> {
  await promoteDueScheduledPosts();
  const rows = await getDb()<BlogPostRow>(TABLE)
    .where({ status: "published" })
    .select("slug", "updated_at", "published_at");
  return rows.map((row) => ({
    slug: row.slug,
    updatedAt: new Date(row.updated_at).toISOString(),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
  }));
}

export async function getBlogPostBySlugPublic(
  slug: string
): Promise<BlogPostDto & { relatedPosts: BlogPostSummaryDto[] }> {
  await promoteDueScheduledPosts();
  const row = await getDb()<BlogPostRow>(TABLE).where({ slug, status: "published" }).first();
  if (!row) throw new NotFoundError("Blog post not found.");

  const dto = toBlogPostDto(row, await hydrateOne(row));

  let related: BlogPostRow[] = [];
  if (row.category_id) {
    related = await getDb()<BlogPostRow>(TABLE)
      .where({ status: "published", category_id: row.category_id })
      .andWhereNot({ id: row.id })
      .orderBy("published_at", "desc")
      .limit(3);
  }
  if (related.length < 3) {
    const excludeIds = [row.id, ...related.map((r) => r.id)];
    const fallback = await getDb()<BlogPostRow>(TABLE)
      .where({ status: "published" })
      .whereNotIn("id", excludeIds)
      .orderBy("published_at", "desc")
      .limit(3 - related.length);
    related = [...related, ...fallback];
  }
  const relatedHydrated = await hydrateMany(related);
  const relatedPosts = related.map((r) => toBlogPostSummaryDto(r, relatedHydrated.get(r.id)!));

  return { ...dto, relatedPosts };
}

// ---------------------------------------------------------------------------
// Writes — admin only (enforced by the routes, not here)
// ---------------------------------------------------------------------------

export interface BlogPostWriteInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  featuredImageMediaId?: string | null;
  featuredImageAlt?: string | null;
  ogImageMediaId?: string | null;
  categoryId?: string | null;
  tagIds?: string[];
  status?: BlogPostStatus;
  publishedAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
}

export async function createBlogPost(
  input: BlogPostWriteInput,
  author: { sub: string; name: string }
): Promise<BlogPostDto> {
  const existingSlug = await getDb()<BlogPostRow>(TABLE).where({ slug: input.slug }).first();
  if (existingSlug) throw new ConflictError(`A blog post with slug "${input.slug}" already exists.`);

  const status = input.status ?? "draft";
  const publishedAt = resolvePublishedAt(status, input.publishedAt ?? null, null);
  const sanitized = sanitizeContent(input.content);
  const { wordCount, readingTimeMinutes } = computeWordStats(sanitized);

  const id = randomUUID();
  await getDb()<BlogPostRow>(TABLE).insert({
    id,
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt ?? null,
    content: sanitized,
    featured_image_media_id: input.featuredImageMediaId ?? null,
    featured_image_alt: input.featuredImageAlt ?? null,
    og_image_media_id: input.ogImageMediaId ?? null,
    category_id: input.categoryId ?? null,
    author_sub: author.sub,
    author_name: author.name,
    status,
    published_at: publishedAt,
    archived_at: status === "archived" ? new Date() : null,
    seo_title: input.seoTitle ?? null,
    seo_description: input.seoDescription ?? null,
    canonical_url: input.canonicalUrl ?? null,
    word_count: wordCount,
    reading_time_minutes: readingTimeMinutes,
  } as unknown as BlogPostRow);

  if (input.tagIds && input.tagIds.length > 0) {
    await setPostTags(id, input.tagIds);
  }

  return getBlogPostByIdAdmin(id);
}

export type BlogPostUpdateInput = Partial<BlogPostWriteInput>;

export async function updateBlogPost(id: string, input: BlogPostUpdateInput): Promise<BlogPostDto> {
  const existing = await getDb()<BlogPostRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Blog post not found.");

  if (input.slug !== undefined && input.slug !== existing.slug) {
    const collision = await getDb()<BlogPostRow>(TABLE).where({ slug: input.slug }).andWhereNot({ id }).first();
    if (collision) throw new ConflictError(`A blog post with slug "${input.slug}" already exists.`);
  }

  const nextStatus = input.status ?? existing.status;
  const publishedAt = resolvePublishedAt(nextStatus, input.publishedAt, existing.published_at);

  const patch: Partial<BlogPostRow> = {};
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.title !== undefined) patch.title = input.title;
  if (input.excerpt !== undefined) patch.excerpt = input.excerpt;
  if (input.content !== undefined) {
    const sanitized = sanitizeContent(input.content);
    const stats = computeWordStats(sanitized);
    patch.content = sanitized;
    patch.word_count = stats.wordCount;
    patch.reading_time_minutes = stats.readingTimeMinutes;
  }
  if (input.featuredImageMediaId !== undefined) patch.featured_image_media_id = input.featuredImageMediaId;
  if (input.featuredImageAlt !== undefined) patch.featured_image_alt = input.featuredImageAlt;
  if (input.ogImageMediaId !== undefined) patch.og_image_media_id = input.ogImageMediaId;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.status !== undefined) patch.status = input.status;
  patch.published_at = publishedAt;
  if (nextStatus === "archived" && existing.status !== "archived") {
    patch.archived_at = new Date();
  } else if (nextStatus !== "archived" && existing.status === "archived") {
    patch.archived_at = null;
  }
  if (input.seoTitle !== undefined) patch.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) patch.seo_description = input.seoDescription;
  if (input.canonicalUrl !== undefined) patch.canonical_url = input.canonicalUrl;

  if (Object.keys(patch).length > 0) {
    await getDb()<BlogPostRow>(TABLE).where({ id }).update(patch);
  }

  if (input.tagIds !== undefined) {
    await setPostTags(id, input.tagIds);
  }

  return getBlogPostByIdAdmin(id);
}

/**
 * True, permanent removal. The admin UI should present "Archive" (a
 * status change, fully reversible, satisfies requirement 3's "unpublish
 * or archive without permanently deleting") as the primary destructive-
 * safe action, and reserve this for an explicit "Delete permanently"
 * confirmation. `blog_post_tags` rows cascade-delete automatically via
 * the migration's FK — nothing extra to clean up here.
 */
export async function deleteBlogPost(id: string): Promise<void> {
  const deleted = await getDb()<BlogPostRow>(TABLE).where({ id }).delete();
  if (!deleted) throw new NotFoundError("Blog post not found.");
}

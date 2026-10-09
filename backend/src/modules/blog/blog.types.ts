export type BlogPostStatus = "draft" | "scheduled" | "published" | "archived";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface BlogCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean | number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface BlogCategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
}

export function toBlogCategoryDto(row: BlogCategoryRow): BlogCategoryDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
  };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface BlogTagRow {
  id: string;
  slug: string;
  name: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface BlogTagDto {
  id: string;
  slug: string;
  name: string;
}

export function toBlogTagDto(row: BlogTagRow): BlogTagDto {
  return { id: row.id, slug: row.slug, name: row.name };
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  featured_image_media_id: string | null;
  featured_image_alt: string | null;
  og_image_media_id: string | null;
  category_id: string | null;
  author_sub: string;
  author_name: string;
  status: BlogPostStatus;
  published_at: Date | string | null;
  archived_at: Date | string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  word_count: number | null;
  reading_time_minutes: number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Cross-table data the service layer resolves for a row before it can be
 * turned into a DTO (category/tags/media URLs aren't columns on
 * `blog_posts` itself — see `blogPosts.service.ts`'s `hydrateMany`). Kept
 * as a separate interface rather than extending `BlogPostRow` so the
 * mapper's inputs are explicit about what came from the database versus
 * what came from a join.
 */
export interface BlogPostHydrated {
  category: BlogCategoryDto | null;
  tags: BlogTagDto[];
  featuredImageUrl: string | null;
  ogImageUrl: string | null;
}

export interface BlogImageRef {
  mediaId: string;
  url: string | null;
  alt: string | null;
}

/**
 * Listing shape — deliberately omits `content` (requirement 9: "Avoid
 * loading all article content on the Blog listing page"). Everything a
 * card/row needs (title, excerpt, image, category, tags, author, dates,
 * reading time) without ever selecting or serializing the article body.
 */
export interface BlogPostSummaryDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featuredImage: BlogImageRef | null;
  category: BlogCategoryDto | null;
  tags: BlogTagDto[];
  authorName: string;
  status: BlogPostStatus;
  publishedAt: string | null;
  wordCount: number | null;
  readingTimeMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Full shape — single-post (public detail, admin editor) only. */
export interface BlogPostDto extends BlogPostSummaryDto {
  content: string;
  ogImage: { mediaId: string; url: string | null } | null;
  archivedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
}

export function toBlogPostSummaryDto(row: BlogPostRow, hydrated: BlogPostHydrated): BlogPostSummaryDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    featuredImage: row.featured_image_media_id
      ? { mediaId: row.featured_image_media_id, url: hydrated.featuredImageUrl, alt: row.featured_image_alt }
      : null,
    category: hydrated.category,
    tags: hydrated.tags,
    authorName: row.author_name,
    status: row.status,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    wordCount: row.word_count,
    readingTimeMinutes: row.reading_time_minutes,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function toBlogPostDto(row: BlogPostRow, hydrated: BlogPostHydrated): BlogPostDto {
  return {
    ...toBlogPostSummaryDto(row, hydrated),
    content: row.content,
    ogImage: row.og_image_media_id ? { mediaId: row.og_image_media_id, url: hydrated.ogImageUrl } : null,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    canonicalUrl: row.canonical_url,
  };
}

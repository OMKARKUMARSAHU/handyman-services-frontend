import { apiRequest, AuthApiError } from "@/lib/auth/api";

/**
 * Admin Blog API client — thin typed wrapper around
 * `backend/src/modules/blog/blog.routes.ts`, same shape as every other
 * admin-api module here (`content-api.ts`, `media-library-api.ts`,
 * `catalog-api.ts`): plain `apiRequest` calls, DTOs mirrored field-for-
 * field from the backend's `blog.types.ts`. Pagination is returned
 * inline as `{items, total, page, pageSize}` (not via the response
 * envelope's separate `meta` field) because `apiRequest()` only ever
 * returns a response's `data` — the same reason `media-library-api.ts`'s
 * `listMedia()` shapes its result the same way.
 */
export { AuthApiError };

export type BlogPostStatus = "draft" | "scheduled" | "published" | "archived";

export interface BlogCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
}

export interface BlogTag {
  id: string;
  slug: string;
  name: string;
}

export interface BlogImageRef {
  mediaId: string;
  url: string | null;
  alt: string | null;
}

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featuredImage: BlogImageRef | null;
  category: BlogCategory | null;
  tags: BlogTag[];
  authorName: string;
  status: BlogPostStatus;
  publishedAt: string | null;
  wordCount: number | null;
  readingTimeMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost extends BlogPostSummary {
  content: string;
  ogImage: { mediaId: string; url: string | null } | null;
  archivedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
}

export interface BlogPostDetailPublic extends BlogPost {
  relatedPosts: BlogPostSummary[];
}

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

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------
// Admin — categories
// ---------------------------------------------------------------------

export function listBlogCategoriesAdmin(): Promise<BlogCategory[]> {
  return apiRequest<BlogCategory[]>("/admin/blog/categories", { method: "GET" });
}

export interface BlogCategoryInput {
  slug: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export function createBlogCategory(input: BlogCategoryInput): Promise<BlogCategory> {
  return apiRequest<BlogCategory>("/admin/blog/categories", { method: "POST", body: JSON.stringify(input) });
}

export function updateBlogCategory(id: string, input: Partial<BlogCategoryInput>): Promise<BlogCategory> {
  return apiRequest<BlogCategory>(`/admin/blog/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteBlogCategory(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/admin/blog/categories/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------
// Admin — tags
// ---------------------------------------------------------------------

export function listBlogTagsAdmin(): Promise<BlogTag[]> {
  return apiRequest<BlogTag[]>("/admin/blog/tags", { method: "GET" });
}

export interface BlogTagInput {
  slug: string;
  name: string;
}

export function createBlogTag(input: BlogTagInput): Promise<BlogTag> {
  return apiRequest<BlogTag>("/admin/blog/tags", { method: "POST", body: JSON.stringify(input) });
}

export function updateBlogTag(id: string, input: Partial<BlogTagInput>): Promise<BlogTag> {
  return apiRequest<BlogTag>(`/admin/blog/tags/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteBlogTag(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/admin/blog/tags/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------
// Admin — posts
// ---------------------------------------------------------------------

export interface AdminListBlogPostsParams {
  status?: BlogPostStatus;
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
  sort?: "newest" | "oldest" | "title";
  page?: number;
  pageSize?: number;
}

export function listBlogPostsAdmin(params: AdminListBlogPostsParams = {}): Promise<PagedResult<BlogPostSummary>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.categorySlug) query.set("categorySlug", params.categorySlug);
  if (params.tagSlug) query.set("tagSlug", params.tagSlug);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 20));
  return apiRequest<PagedResult<BlogPostSummary>>(`/admin/blog/posts?${query.toString()}`, { method: "GET" });
}

export function getBlogPostAdmin(id: string): Promise<BlogPost> {
  return apiRequest<BlogPost>(`/admin/blog/posts/${id}`, { method: "GET" });
}

export function createBlogPost(input: BlogPostWriteInput): Promise<BlogPost> {
  return apiRequest<BlogPost>("/admin/blog/posts", { method: "POST", body: JSON.stringify(input) });
}

export function updateBlogPost(id: string, input: Partial<BlogPostWriteInput>): Promise<BlogPost> {
  return apiRequest<BlogPost>(`/admin/blog/posts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteBlogPost(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/admin/blog/posts/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------
// Public reads — used by the public Blog pages (server-side, via
// `@/lib/data/live`'s `backendGet`, not this client — kept here only for
// any client-side fetch a public page component might need, e.g. the
// "Load more" button on the listing page).
// ---------------------------------------------------------------------

export interface PublicListBlogPostsParams {
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function listBlogPostsPublic(params: PublicListBlogPostsParams = {}): Promise<PagedResult<BlogPostSummary>> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 9));
  return apiRequest<PagedResult<BlogPostSummary>>(`/blog/posts?${query.toString()}`, { method: "GET" });
}

export function getBlogPostPublic(slug: string): Promise<BlogPostDetailPublic> {
  return apiRequest<BlogPostDetailPublic>(`/blog/posts/${slug}`, { method: "GET" });
}

export function listBlogCategoriesPublic(): Promise<BlogCategory[]> {
  return apiRequest<BlogCategory[]>("/blog/categories", { method: "GET" });
}

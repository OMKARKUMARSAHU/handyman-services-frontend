import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { created, ok } from "../../shared/response";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  blogCategoryIdParamsSchema,
  blogPostIdParamsSchema,
  blogPostSlugParamsSchema,
  blogTagIdParamsSchema,
  createBlogCategorySchema,
  createBlogPostSchema,
  createBlogTagSchema,
  listBlogPostsQuerySchema,
  publicListBlogPostsQuerySchema,
  updateBlogCategorySchema,
  updateBlogPostSchema,
  updateBlogTagSchema,
} from "./blog.schema";
import { createBlogCategory, deleteBlogCategory, listBlogCategories, updateBlogCategory } from "./blogCategories.service";
import { createBlogTag, deleteBlogTag, listBlogTags, updateBlogTag } from "./blogTags.service";
import {
  createBlogPost,
  deleteBlogPost,
  getBlogPostByIdAdmin,
  getBlogPostBySlugPublic,
  listBlogPostsAdmin,
  listBlogPostsPublic,
  listPublishedBlogPostSlugsForSitemap,
  updateBlogPost,
  type AdminListBlogPostsParams,
  type PublicListBlogPostsParams,
} from "./blogPosts.service";

/**
 * Blog Management System — backend routes. Mirrors `content.routes.ts` /
 * `categories.routes.ts` / `media-library.routes.ts` exactly: public GETs
 * are unauthenticated and read-only (published posts / active categories
 * only — never a draft, scheduled, or archived post, per requirement 3's
 * "Public visitors must never be able to access admin-only operations");
 * every write and every cross-status read lives under `/admin/blog/...`,
 * gated by `authenticate()` + `requireRole("admin")` — the same two-step
 * pipeline every other admin route in this backend uses, never a 4th
 * role. Mounted into `buildRouter()` in `routes/index.ts`.
 */
export function blogRouter(): Router {
  const router = Router();

  // ---------------------------------------------------------------
  // Public — published posts / active categories only
  // ---------------------------------------------------------------
  router.get(
    "/blog/categories",
    asyncHandler(async (_req, res) => {
      ok(res, await listBlogCategories());
    })
  );

  router.get(
    "/blog/posts",
    validateQuery(publicListBlogPostsQuerySchema),
    asyncHandler(async (req, res) => {
      const query = req.query as unknown as { category?: string; search?: string; page?: number; pageSize?: number };
      const params: PublicListBlogPostsParams = {
        categorySlug: query.category,
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
      };
      const result = await listBlogPostsPublic(params);
      ok(res, result);
    })
  );

  router.get(
    "/blog/posts/:slug",
    validateParams(blogPostSlugParamsSchema),
    asyncHandler(async (req, res) => {
      ok(res, await getBlogPostBySlugPublic(req.params.slug!));
    })
  );

  // Requirement 7 (automatic Google indexing): every eligible published
  // article's slug + dates, unpaginated, for the frontend's
  // `src/app/sitemap.ts` to enumerate without paging through the public
  // listing endpoint. Deliberately separate from `GET /blog/posts` (which
  // is capped at pageSize=50 and hydrates category/tags/images it doesn't
  // need here).
  router.get(
    "/blog/sitemap-urls",
    asyncHandler(async (_req, res) => {
      ok(res, await listPublishedBlogPostSlugsForSitemap());
    })
  );

  // ---------------------------------------------------------------
  // Admin — categories
  // ---------------------------------------------------------------
  router.get(
    "/admin/blog/categories",
    authenticate(),
    requireRole("admin"),
    asyncHandler(async (_req, res) => {
      ok(res, await listBlogCategories({ includeInactive: true }));
    })
  );
  router.post(
    "/admin/blog/categories",
    authenticate(),
    requireRole("admin"),
    validateBody(createBlogCategorySchema),
    asyncHandler(async (req, res) => created(res, await createBlogCategory(req.body)))
  );
  router.patch(
    "/admin/blog/categories/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(blogCategoryIdParamsSchema),
    validateBody(updateBlogCategorySchema),
    asyncHandler(async (req, res) => ok(res, await updateBlogCategory(req.params.id!, req.body)))
  );
  router.delete(
    "/admin/blog/categories/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(blogCategoryIdParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteBlogCategory(req.params.id!);
      ok(res, { success: true });
    })
  );

  // ---------------------------------------------------------------
  // Admin — tags
  // ---------------------------------------------------------------
  router.get(
    "/admin/blog/tags",
    authenticate(),
    requireRole("admin"),
    asyncHandler(async (_req, res) => ok(res, await listBlogTags()))
  );
  router.post(
    "/admin/blog/tags",
    authenticate(),
    requireRole("admin"),
    validateBody(createBlogTagSchema),
    asyncHandler(async (req, res) => created(res, await createBlogTag(req.body)))
  );
  router.patch(
    "/admin/blog/tags/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(blogTagIdParamsSchema),
    validateBody(updateBlogTagSchema),
    asyncHandler(async (req, res) => ok(res, await updateBlogTag(req.params.id!, req.body)))
  );
  router.delete(
    "/admin/blog/tags/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(blogTagIdParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteBlogTag(req.params.id!);
      ok(res, { success: true });
    })
  );

  // ---------------------------------------------------------------
  // Admin — posts
  // ---------------------------------------------------------------
  router.get(
    "/admin/blog/posts",
    authenticate(),
    requireRole("admin"),
    validateQuery(listBlogPostsQuerySchema),
    asyncHandler(async (req, res) => {
      const params = req.query as unknown as AdminListBlogPostsParams;
      const result = await listBlogPostsAdmin(params);
      ok(res, result);
    })
  );
  router.get(
    "/admin/blog/posts/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(blogPostIdParamsSchema),
    asyncHandler(async (req, res) => ok(res, await getBlogPostByIdAdmin(req.params.id!)))
  );
  router.post(
    "/admin/blog/posts",
    authenticate(),
    requireRole("admin"),
    validateBody(createBlogPostSchema),
    asyncHandler(async (req, res) => {
      const { sub, claims } = req.auth!;
      const name = typeof claims.name === "string" ? claims.name : typeof claims.email === "string" ? claims.email : "Admin";
      created(res, await createBlogPost(req.body, { sub, name }));
    })
  );
  router.patch(
    "/admin/blog/posts/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(blogPostIdParamsSchema),
    validateBody(updateBlogPostSchema),
    asyncHandler(async (req, res) => ok(res, await updateBlogPost(req.params.id!, req.body)))
  );
  router.delete(
    "/admin/blog/posts/:id",
    authenticate(),
    requireRole("admin"),
    validateParams(blogPostIdParamsSchema),
    asyncHandler(async (req, res) => {
      await deleteBlogPost(req.params.id!);
      ok(res, { success: true });
    })
  );

  return router;
}

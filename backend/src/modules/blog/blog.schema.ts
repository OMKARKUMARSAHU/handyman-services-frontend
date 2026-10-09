import { z } from "zod";

/** Same slug shape as `categories.schema.ts` — lowercase, numbers, hyphens only. */
const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.");

export const blogPostIdParamsSchema = z.object({ id: z.string().uuid() });
export const blogPostSlugParamsSchema = z.object({ slug: z.string().min(1) });
export const blogCategoryIdParamsSchema = z.object({ id: z.string().uuid() });
export const blogTagIdParamsSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const createBlogCategorySchema = z.object({
  slug: slugSchema.max(120),
  name: z.string().min(1).max(150),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});
export const updateBlogCategorySchema = createBlogCategorySchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." });

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const createBlogTagSchema = z.object({
  slug: slugSchema.max(120),
  name: z.string().min(1).max(100),
});
export const updateBlogTagSchema = createBlogTagSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." });

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

const blogPostStatusEnum = z.enum(["draft", "scheduled", "published", "archived"]);

/** Shared field set for create/update — see the two `.refine`s below for the one cross-field rule (scheduling needs a future date). */
const blogPostFieldsSchema = {
  slug: slugSchema.max(160),
  title: z.string().min(1).max(255),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string().min(1),
  featuredImageMediaId: z.string().uuid().nullable().optional(),
  featuredImageAlt: z.string().max(255).nullable().optional(),
  ogImageMediaId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(20).optional(),
  status: blogPostStatusEnum.optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  seoTitle: z.string().max(255).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  canonicalUrl: z.string().url().max(500).nullable().optional(),
};

export const createBlogPostSchema = z
  .object(blogPostFieldsSchema)
  .refine((v) => v.status !== "scheduled" || (!!v.publishedAt && new Date(v.publishedAt).getTime() > Date.now()), {
    message: "A scheduled post requires publishedAt to be a date in the future.",
    path: ["publishedAt"],
  });

export const updateBlogPostSchema = z
  .object(blogPostFieldsSchema)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." })
  .refine(
    (v) =>
      v.status !== "scheduled" ||
      v.publishedAt === undefined ||
      (v.publishedAt !== null && new Date(v.publishedAt).getTime() > Date.now()),
    { message: "A scheduled post requires publishedAt to be a date in the future.", path: ["publishedAt"] }
  );

export const listBlogPostsQuerySchema = z.object({
  status: blogPostStatusEnum.optional(),
  categorySlug: z.string().optional(),
  tagSlug: z.string().optional(),
  search: z.string().max(255).optional(),
  sort: z.enum(["newest", "oldest", "title"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const publicListBlogPostsQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(50).optional(),
});

import { randomUUID } from "node:crypto";
import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";
import { getDb } from "../../src/database/db";
import { promoteDueScheduledPosts } from "../../src/modules/blog/blogPosts.service";

/**
 * Blog Management System (Task 4, §10 — "Write automated tests covering
 * permissions, publishing workflow, slug uniqueness, and public
 * visibility"). Mirrors `content.test.ts`'s own structure/conventions
 * exactly (real HTTP requests via `testAgent()`, real signed JWTs via
 * `mintToken()`, a clean DB per test via `resetDatabase()` — nothing
 * mocked at the module level), run against the disposable local
 * `handyman_test` MySQL database, never the real RDS instance.
 */
describe("blog", () => {
  const adminToken = mintToken({ role: "admin" });
  const customerToken = mintToken({ role: "customer" });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function createCategory(overrides: Partial<{ slug: string; name: string }> = {}) {
    const unique = randomUUID().slice(0, 8);
    const res = await testAgent()
      .post("/api/v1/admin/blog/categories")
      .set("Authorization", bearer(adminToken))
      .send({ slug: `test-category-${unique}`, name: "Test Category", ...overrides });
    expect(res.status).toBe(201);
    return res.body.data as { id: string; slug: string; name: string };
  }

  async function createPost(overrides: Record<string, unknown> = {}) {
    const unique = randomUUID().slice(0, 8);
    const res = await testAgent()
      .post("/api/v1/admin/blog/posts")
      .set("Authorization", bearer(adminToken))
      .send({
        slug: `test-post-${unique}`,
        title: "Test Post",
        excerpt: "A short summary.",
        content: "<p>Hello <strong>world</strong>.</p>",
        ...overrides,
      });
    return res;
  }

  // -------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------

  it("blocks a customer (and an unauthenticated caller) from every admin blog write", async () => {
    const noAuthRes = await testAgent().post("/api/v1/admin/blog/posts").send({
      slug: "unauthorized-post",
      title: "Nope",
      content: "<p>Nope</p>",
    });
    expect(noAuthRes.status).toBe(401);

    const customerRes = await testAgent()
      .post("/api/v1/admin/blog/posts")
      .set("Authorization", bearer(customerToken))
      .send({ slug: "unauthorized-post", title: "Nope", content: "<p>Nope</p>" });
    expect(customerRes.status).toBe(403);

    const categoryRes = await testAgent()
      .post("/api/v1/admin/blog/categories")
      .set("Authorization", bearer(customerToken))
      .send({ slug: "unauthorized-category", name: "Nope" });
    expect(categoryRes.status).toBe(403);
  });

  it("lets admin manage categories and tags, and blocks deleting a category still in use", async () => {
    const category = await createCategory();

    const tagRes = await testAgent()
      .post("/api/v1/admin/blog/tags")
      .set("Authorization", bearer(adminToken))
      .send({ slug: "how-to", name: "How-To" });
    expect(tagRes.status).toBe(201);

    const postRes = await createPost({ categoryId: category.id, tagIds: [tagRes.body.data.id] });
    expect(postRes.status).toBe(201);

    const deleteInUseRes = await testAgent()
      .delete(`/api/v1/admin/blog/categories/${category.id}`)
      .set("Authorization", bearer(adminToken));
    expect(deleteInUseRes.status).toBe(409);

    const publicCategoriesRes = await testAgent().get("/api/v1/blog/categories");
    expect(publicCategoriesRes.status).toBe(200);
    expect(publicCategoriesRes.body.data.some((c: { slug: string }) => c.slug === category.slug)).toBe(true);
  });

  // -------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------

  it("rejects a post missing required fields, and an invalid slug", async () => {
    const missingContentRes = await testAgent()
      .post("/api/v1/admin/blog/posts")
      .set("Authorization", bearer(adminToken))
      .send({ slug: "missing-content", title: "No content" });
    expect(missingContentRes.status).toBe(400);

    const badSlugRes = await createPost({ slug: "Not A Valid Slug!" });
    expect(badSlugRes.status).toBe(400);
  });

  it("rejects scheduling a post without a future publish date", async () => {
    const res = await createPost({
      status: "scheduled",
      publishedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------
  // Slug uniqueness
  // -------------------------------------------------------------------

  it("rejects creating a post with a slug that already exists, and updating into a collision", async () => {
    const first = await createPost({ slug: "duplicate-slug-test" });
    expect(first.status).toBe(201);

    const duplicate = await createPost({ slug: "duplicate-slug-test" });
    expect(duplicate.status).toBe(409);

    const second = await createPost({ slug: "second-post-slug" });
    expect(second.status).toBe(201);

    const collideRes = await testAgent()
      .patch(`/api/v1/admin/blog/posts/${second.body.data.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ slug: "duplicate-slug-test" });
    expect(collideRes.status).toBe(409);
  });

  // -------------------------------------------------------------------
  // Publishing workflow + public visibility
  // -------------------------------------------------------------------

  it("never exposes a draft post publicly, then publishes it via update", async () => {
    const draft = await createPost({ slug: "draft-visibility-test" });
    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe("draft");

    const publicListRes = await testAgent().get("/api/v1/blog/posts");
    expect(publicListRes.body.data.items).toEqual([]);

    const publicDetailRes = await testAgent().get("/api/v1/blog/posts/draft-visibility-test");
    expect(publicDetailRes.status).toBe(404);

    const publishRes = await testAgent()
      .patch(`/api/v1/admin/blog/posts/${draft.body.data.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ status: "published" });
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.status).toBe("published");
    expect(publishRes.body.data.publishedAt).toBeTruthy();

    const publicListAfterRes = await testAgent().get("/api/v1/blog/posts");
    expect(publicListAfterRes.body.data.items).toHaveLength(1);
    expect(publicListAfterRes.body.data.items[0].slug).toBe("draft-visibility-test");
    // Listing is the summary shape — never serializes the full article body.
    expect(publicListAfterRes.body.data.items[0].content).toBeUndefined();

    const publicDetailAfterRes = await testAgent().get("/api/v1/blog/posts/draft-visibility-test");
    expect(publicDetailAfterRes.status).toBe(200);
    expect(publicDetailAfterRes.body.data.content).toContain("Hello");
    expect(Array.isArray(publicDetailAfterRes.body.data.relatedPosts)).toBe(true);
  });

  it("never exposes an archived post publicly even though it was previously published", async () => {
    const post = await createPost({ slug: "archive-visibility-test", status: "published" });
    expect(post.status).toBe(201);

    const visibleRes = await testAgent().get("/api/v1/blog/posts/archive-visibility-test");
    expect(visibleRes.status).toBe(200);

    const archiveRes = await testAgent()
      .patch(`/api/v1/admin/blog/posts/${post.body.data.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ status: "archived" });
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.archivedAt).toBeTruthy();

    const hiddenRes = await testAgent().get("/api/v1/blog/posts/archive-visibility-test");
    expect(hiddenRes.status).toBe(404);

    // Archiving is a status change, not a delete — the row (and its
    // publish history) still exists for Admin.
    const adminRes = await testAgent()
      .get(`/api/v1/admin/blog/posts/${post.body.data.id}`)
      .set("Authorization", bearer(adminToken));
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.status).toBe("archived");
  });

  it("promotes a scheduled post to published once its publish time has passed, with no cron involved", async () => {
    const scheduled = await createPost({
      slug: "scheduled-promotion-test",
      status: "scheduled",
      publishedAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(scheduled.status).toBe(201);
    expect(scheduled.body.data.status).toBe("scheduled");

    const tooSoonRes = await testAgent().get("/api/v1/blog/posts/scheduled-promotion-test");
    expect(tooSoonRes.status).toBe(404);

    // Simulate the scheduled time having passed (no cron exists in this
    // backend; promotion happens lazily on read — see
    // `promoteDueScheduledPosts()` in `blogPosts.service.ts`). This moves
    // the row's `published_at` into the past directly, the same way a
    // real clock tick would, rather than waiting out a real 60s delay in
    // the test.
    await getDb()("blog_posts")
      .where({ slug: "scheduled-promotion-test" })
      .update({ published_at: new Date(Date.now() - 1000) });

    const nowVisibleRes = await testAgent().get("/api/v1/blog/posts/scheduled-promotion-test");
    expect(nowVisibleRes.status).toBe(200);
    expect(nowVisibleRes.body.data.status).toBe("published");

    const adminListRes = await testAgent()
      .get("/api/v1/admin/blog/posts?status=published")
      .set("Authorization", bearer(adminToken));
    expect(adminListRes.body.data.items.some((p: { slug: string }) => p.slug === "scheduled-promotion-test")).toBe(
      true
    );
  });

  it("the scheduler job publishes a due post without any read request touching it", async () => {
    const scheduled = await createPost({
      slug: "scheduler-job-test",
      status: "scheduled",
      publishedAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(scheduled.status).toBe(201);
    await getDb()("blog_posts").where({ slug: "scheduler-job-test" }).update({ published_at: new Date(Date.now() - 1000) });

    // Read the raw row, not through the API (every API read also promotes).
    expect((await getDb()("blog_posts").where({ slug: "scheduler-job-test" }).first("status")).status).toBe("scheduled");
    expect(await promoteDueScheduledPosts()).toBe(1);
    expect((await getDb()("blog_posts").where({ slug: "scheduler-job-test" }).first("status")).status).toBe("published");
    // Idempotent: a second tick (or a second server instance) finds nothing to do.
    expect(await promoteDueScheduledPosts()).toBe(0);
  });

  it("'Publish Now' on a future-scheduled post goes live now, not at the old scheduled time", async () => {
    const scheduled = await createPost({
      slug: "publish-now-test",
      status: "scheduled",
      publishedAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });
    const res = await testAgent()
      .patch(`/api/v1/admin/blog/posts/${scheduled.body.data.id}`)
      .set("Authorization", bearer(adminToken))
      .send({ status: "published" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("published");
    // MySQL DATETIME (no fractional seconds) rounds to the nearest second, so allow 1s of slack.
    expect(new Date(res.body.data.publishedAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect((await testAgent().get("/api/v1/blog/posts/publish-now-test")).status).toBe(200);
  });

  it("saves the chosen category on create and returns the post under that category only", async () => {
    const handyman = await createCategory({ slug: "handyman-services", name: "Handyman Services" });
    const other = await createCategory({ slug: "other-cat", name: "Other" });
    const created = await createPost({ slug: "cat-assoc", status: "published", categoryId: handyman.id });
    expect(created.body.data.category?.id).toBe(handyman.id);

    const adminFiltered = await testAgent()
      .get("/api/v1/admin/blog/posts?categorySlug=handyman-services")
      .set("Authorization", bearer(adminToken));
    expect(adminFiltered.body.data.items.map((p: { slug: string }) => p.slug)).toEqual(["cat-assoc"]);
    const publicFiltered = await testAgent().get("/api/v1/blog/posts?category=handyman-services");
    expect(publicFiltered.body.data.items.map((p: { slug: string }) => p.slug)).toEqual(["cat-assoc"]);
    const otherFiltered = await testAgent().get(`/api/v1/blog/posts?category=${other.slug}`);
    expect(otherFiltered.body.data.items).toHaveLength(0);
  });

  it("filters the public listing by category and search, and paginates", async () => {
    const category = await createCategory();
    await createPost({ slug: "filter-a", title: "Washing Machine Repair Guide", status: "published", categoryId: category.id });
    await createPost({ slug: "filter-b", title: "Refrigerator Maintenance Tips", status: "published" });
    await createPost({ slug: "filter-c", title: "Another Washing Machine Article", status: "published" });

    const byCategoryRes = await testAgent().get(`/api/v1/blog/posts?category=${category.slug}`);
    expect(byCategoryRes.body.data.items).toHaveLength(1);
    expect(byCategoryRes.body.data.items[0].slug).toBe("filter-a");

    const bySearchRes = await testAgent().get(`/api/v1/blog/posts?search=${encodeURIComponent("Washing Machine")}`);
    expect(bySearchRes.body.data.total).toBe(2);

    const pagedRes = await testAgent().get("/api/v1/blog/posts?pageSize=1&page=1");
    expect(pagedRes.body.data.items).toHaveLength(1);
    expect(pagedRes.body.data.total).toBe(3);
    expect(pagedRes.body.data.pageSize).toBe(1);
  });

  it("exposes every published post's slug for the sitemap, and only those", async () => {
    await createPost({ slug: "sitemap-published", status: "published" });
    await createPost({ slug: "sitemap-draft" });

    const res = await testAgent().get("/api/v1/blog/sitemap-urls");
    expect(res.status).toBe(200);
    const slugs = res.body.data.map((row: { slug: string }) => row.slug);
    expect(slugs).toContain("sitemap-published");
    expect(slugs).not.toContain("sitemap-draft");
  });

  it("computes word count and reading time on save", async () => {
    const longContent = `<p>${"word ".repeat(250)}</p>`;
    const res = await createPost({ slug: "reading-time-test", content: longContent });
    expect(res.status).toBe(201);
    expect(res.body.data.wordCount).toBeGreaterThanOrEqual(250);
    expect(res.body.data.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it("sanitizes a script tag out of the post content on save", async () => {
    const res = await createPost({
      slug: "xss-sanitize-test",
      content: "<p>Safe text</p><script>alert('xss')</script>",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.content).not.toContain("<script>");
    expect(res.body.data.content).toContain("Safe text");
  });
});

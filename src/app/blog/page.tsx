import type { Metadata } from "next";
import { listBlogPostsLive, listBlogCategoriesLive } from "@/lib/data/live";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { BlogFeaturedPost } from "@/components/blog/BlogFeaturedPost";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { BlogSearchForm } from "@/components/blog/BlogSearchForm";
import { BlogCategoryFilter } from "@/components/blog/BlogCategoryFilter";
import { BlogPagination } from "@/components/blog/BlogPagination";
import { Icon } from "@/lib/icons";

const PAGE_SIZE = 9;

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Appliance care guides, maintenance tips, and how-tos from Handyman Services — practical advice to keep your home appliances running longer.",
};

/**
 * Blog Management System (Task 4, §4) — the dedicated public blog
 * listing page. Server-rendered (no "use client"): search and category
 * filtering are plain GET-form/link navigations to this same route with
 * different query params (see `BlogSearchForm`/`BlogCategoryFilter`), so
 * every filtered/paginated view is a real, independently shareable and
 * crawlable URL rather than client-only state — and the page works with
 * JavaScript disabled.
 *
 * `listBlogPostsLive` (added to `src/lib/data/live.ts` in this same
 * pass) only ever resolves to PUBLISHED posts — the backend's
 * `listBlogPostsPublic` service function filters `status = 'published'`
 * and `published_at <= now()` at the query level — so this page can
 * never leak a draft, scheduled, or archived post no matter what filters
 * a visitor applies.
 */
export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const categorySlug = params.category?.trim() || undefined;
  const requestedPage = Number(params.page);
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;

  const [listing, categories] = await Promise.all([
    listBlogPostsLive({ categorySlug, search, page, pageSize: PAGE_SIZE }),
    listBlogCategoriesLive(),
  ]);

  const isFirstUnfilteredPage = page === 1 && !search && !categorySlug;
  const featuredPost = isFirstUnfilteredPage ? listing.items[0] : undefined;
  const gridPosts = featuredPost ? listing.items.slice(1) : listing.items;
  const totalPages = Math.max(1, Math.ceil(listing.total / listing.pageSize));

  return (
    <>
      <PageHeader
        heading="Blog"
        subheading="Appliance care guides, maintenance tips, and how-tos to help your home appliances run longer."
      />

      <section className="py-12 sm:py-16">
        <Container>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BlogCategoryFilter categories={categories} activeCategorySlug={categorySlug} search={search} />
            <BlogSearchForm defaultValue={search ?? ""} category={categorySlug} />
          </div>

          {listing.items.length === 0 ? (
            <BlogEmptyState search={search} />
          ) : (
            <div className="flex flex-col gap-8">
              {featuredPost && <BlogFeaturedPost post={featuredPost} />}

              {gridPosts.length > 0 && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {gridPosts.map((post) => (
                    <BlogPostCard key={post.id} post={post} />
                  ))}
                </div>
              )}

              <div className="pt-4">
                <BlogPagination page={page} totalPages={totalPages} search={search} category={categorySlug} />
              </div>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}

/**
 * Covers both a genuinely empty result set (no posts match the filter)
 * and a backend that's unreachable — `listBlogPostsLive` falls back to
 * `{items: [], total: 0, ...}` in either case (see its own comment in
 * `live.ts`), so this page never renders blank or throws; it just reads
 * as "no posts yet" rather than an error, which is honest either way
 * since no fabricated content is shown.
 */
function BlogEmptyState({ search }: { search?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-200 py-16 text-center">
      <Icon name="file-text" className="h-10 w-10 text-neutral-300" />
      <p className="text-base font-semibold text-neutral-700">
        {search ? `No articles found for "${search}"` : "No articles published yet"}
      </p>
      <p className="max-w-sm text-sm text-neutral-500">
        {search
          ? "Try a different search term, or browse by category above."
          : "Check back soon — new appliance care guides and tips are on the way."}
      </p>
    </div>
  );
}

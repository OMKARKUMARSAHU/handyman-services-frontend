import Link from "next/link";
import type { LiveBlogCategory } from "@/lib/data/live";
import { cn } from "@/lib/utils";

/**
 * Blog Management System (Task 4, §4 — "category filters"). Plain links
 * (not a client-side `<select>`/buttons), each one a full, independent
 * `/blog?...` URL — so every filtered view is itself a real, shareable,
 * bookmarkable, crawlable page rather than client-only state, matching
 * the spec's "shareable URLs for individual posts and filtered views".
 * Changing the category always resets to page 1 but keeps the current
 * search term.
 */
export function BlogCategoryFilter({
  categories,
  activeCategorySlug,
  search,
}: {
  categories: LiveBlogCategory[];
  activeCategorySlug?: string;
  search?: string;
}) {
  if (categories.length === 0) return null;

  const hrefFor = (categorySlug?: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categorySlug) params.set("category", categorySlug);
    const query = params.toString();
    return query ? `/blog?${query}` : "/blog";
  };

  const pillClass = (isActive: boolean) =>
    cn(
      "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
      isActive
        ? "bg-brand-600 text-white"
        : "bg-neutral-100 text-neutral-600 hover:bg-brand-50 hover:text-brand-700"
    );

  return (
    <nav aria-label="Filter by category" className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto">
      <Link href={hrefFor(undefined)} className={pillClass(!activeCategorySlug)}>
        All Posts
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={hrefFor(category.slug)}
          className={pillClass(activeCategorySlug === category.slug)}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}

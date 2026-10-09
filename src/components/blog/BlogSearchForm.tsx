import { Icon } from "@/lib/icons";

/**
 * Blog Management System (Task 4, §4 — "search functionality"). A plain
 * GET form (no client JS/"use client" needed — a GET form is itself just
 * a navigation to `/blog?search=...&category=...`), so it works
 * identically with or without JavaScript and needs no new state
 * management. Submitting a new search always resets to page 1 but keeps
 * whatever category filter was active, via the hidden `category` input.
 */
export function BlogSearchForm({
  defaultValue,
  category,
}: {
  defaultValue: string;
  category?: string;
}) {
  return (
    <form method="GET" action="/blog" className="relative flex-1 sm:max-w-sm">
      {category && <input type="hidden" name="category" value={category} />}
      <label htmlFor="blog-search" className="sr-only">
        Search blog posts
      </label>
      <Icon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
      />
      <input
        id="blog-search"
        type="search"
        name="search"
        defaultValue={defaultValue}
        placeholder="Search articles..."
        className="w-full rounded-full border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-sm text-neutral-800 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      />
    </form>
  );
}

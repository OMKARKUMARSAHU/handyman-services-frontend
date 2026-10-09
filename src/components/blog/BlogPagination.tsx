import Link from "next/link";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Blog Management System (Task 4, §4 — "pagination ... for additional
 * posts"). Plain Previous/Next + numbered links, each a real `/blog?...`
 * URL preserving the active search/category filters — server-rendered,
 * so it works with JavaScript disabled and every page is independently
 * shareable/crawlable, consistent with `BlogCategoryFilter`.
 */
export function BlogPagination({
  page,
  totalPages,
  search,
  category,
}: {
  page: number;
  totalPages: number;
  search?: string;
  category?: string;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (targetPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/blog?${query}` : "/blog";
  };

  // Keep the page-number row short even for a large archive: current
  // page, one neighbor on each side, and the first/last page, with a
  // plain ellipsis (not a link) marking any gap.
  const pageNumbers = new Set<number>([1, totalPages, page, Math.max(1, page - 1), Math.min(totalPages, page + 1)]);
  const sortedPages = Array.from(pageNumbers)
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((a, b) => a - b);

  return (
    <nav aria-label="Blog pagination" className="flex items-center justify-center gap-1.5">
      <PageLink
        href={hrefFor(page - 1)}
        disabled={page <= 1}
        ariaLabel="Previous page"
      >
        <Icon name="chevron-left" className="h-4 w-4" />
      </PageLink>

      {sortedPages.map((pageNumber, index) => {
        const previous = sortedPages[index - 1];
        const showEllipsisBefore = previous !== undefined && pageNumber - previous > 1;
        return (
          <span key={pageNumber} className="flex items-center gap-1.5">
            {showEllipsisBefore && <span className="px-1 text-sm text-neutral-400">…</span>}
            <Link
              href={hrefFor(pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                pageNumber === page
                  ? "bg-brand-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {pageNumber}
            </Link>
          </span>
        );
      })}

      <PageLink
        href={hrefFor(page + 1)}
        disabled={page >= totalPages}
        ariaLabel="Next page"
      >
        <Icon name="chevron-right" className="h-4 w-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  ariaLabel,
  children,
}: {
  href: string;
  disabled: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const className =
    "flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100";
  if (disabled) {
    return (
      <span aria-hidden="true" aria-label={ariaLabel} className={cn(className, "pointer-events-none text-neutral-300")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={ariaLabel} className={className}>
      {children}
    </Link>
  );
}

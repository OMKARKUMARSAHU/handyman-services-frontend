import type { BlogHeading } from "@/lib/blog/toc";
import { cn } from "@/lib/utils";

/**
 * Blog Management System (Task 4, §4 — "table of contents for long
 * posts"). Plain in-page anchor links to the H2/H3 ids
 * `addHeadingIdsAndExtractToc` wrote into the article HTML; no client JS
 * (scroll-spy highlighting) is added, so it works with JavaScript
 * disabled and needs no new dependency.
 */
export function TableOfContents({ headings }: { headings: BlogHeading[] }) {
  if (headings.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        In this article
      </p>
      <ul className="space-y-2 text-sm">
        {headings.map((heading) => (
          <li key={heading.id} className={cn(heading.level === 3 && "pl-3")}>
            <a href={`#${heading.id}`} className="text-neutral-600 hover:text-brand-700">
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

import Link from "next/link";
import type { LiveBlogPostSummary } from "@/lib/data/live";
import { Icon } from "@/lib/icons";
import { formatBlogDate, formatReadingTime } from "@/lib/blog/format";

/**
 * Blog Management System (Task 4, §4 — "featured post highlighted at the
 * top"). Rendered only for the first page of an unfiltered listing (see
 * `src/app/blog/page.tsx`), using the most recently published post — a
 * larger, two-column treatment so the latest article reads as a genuine
 * highlight rather than just the first card in the grid.
 */
export function BlogFeaturedPost({ post }: { post: LiveBlogPostSummary }) {
  const publishedLabel = formatBlogDate(post.publishedAt);
  const readingLabel = formatReadingTime(post.readingTimeMinutes);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group grid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:border-brand-300 hover:shadow-md sm:grid-cols-2"
    >
      {post.featuredImage?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded media-library asset, arbitrary remote origin
        <img
          src={post.featuredImage.url}
          alt={post.featuredImage.alt || post.title}
          className="aspect-[16/9] w-full object-cover sm:aspect-auto sm:h-full"
        />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-400 sm:aspect-auto sm:h-full">
          <Icon name="file-text" className="h-14 w-14" />
        </div>
      )}
      <div className="flex flex-col justify-center p-6 sm:p-8">
        <span className="mb-3 inline-flex w-fit items-center rounded-full bg-accent-100 px-2.5 py-1 text-xs font-semibold text-accent-600">
          Latest Post
        </span>
        {post.category && (
          <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
            {post.category.name}
          </span>
        )}
        <h2 className="text-xl font-extrabold text-neutral-900 group-hover:text-brand-700 sm:text-2xl">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-3 line-clamp-3 text-sm text-neutral-600 sm:text-base">{post.excerpt}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          <span>By {post.authorName}</span>
          {publishedLabel && <span>· {publishedLabel}</span>}
          {readingLabel && <span>· {readingLabel}</span>}
        </div>
      </div>
    </Link>
  );
}

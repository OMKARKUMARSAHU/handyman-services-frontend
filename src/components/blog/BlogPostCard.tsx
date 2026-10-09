import Link from "next/link";
import type { LiveBlogPostSummary } from "@/lib/data/live";
import { Icon } from "@/lib/icons";
import { formatBlogDate, formatReadingTime } from "@/lib/blog/format";

/**
 * Blog Management System (Task 4, §4) — one card in the public listing
 * grid. Visual language intentionally matches `CategoryCard.tsx`
 * (rounded-2xl white card, neutral border, hover lift + border tint) so
 * the Blog section reads as part of the same site rather than a bolted-on
 * design, per the architecture-reuse instruction in the task spec.
 */
export function BlogPostCard({ post }: { post: LiveBlogPostSummary }) {
  const publishedLabel = formatBlogDate(post.publishedAt);
  const readingLabel = formatReadingTime(post.readingTimeMinutes);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-md"
    >
      {post.featuredImage?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded media-library asset, arbitrary remote origin
        <img
          src={post.featuredImage.url}
          alt={post.featuredImage.alt || post.title}
          className="aspect-[16/9] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-400">
          <Icon name="file-text" className="h-10 w-10" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        {post.category && (
          <span className="mb-2 inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
            {post.category.name}
          </span>
        )}
        <h2 className="text-base font-bold text-neutral-900 group-hover:text-brand-700">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{post.excerpt}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          {publishedLabel && (
            <span className="inline-flex items-center gap-1">
              <Icon name="calendar" className="h-3.5 w-3.5" />
              {publishedLabel}
            </span>
          )}
          {readingLabel && (
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {readingLabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getBlogPostBySlugLive } from "@/lib/data/live";
import { addHeadingIdsAndExtractToc } from "@/lib/blog/toc";
import { formatBlogDate, formatReadingTime } from "@/lib/blog/format";
import { SITE_URL } from "@/lib/seo/site";
import { Container } from "@/components/ui/Container";
import { BlogArticleContent } from "@/components/blog/BlogArticleContent";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { Icon } from "@/lib/icons";

// Same reasoning as the other live-data detail pages in this app (see
// `src/app/[city]/service/[serviceSlug]/page.tsx`'s own comment on this
// exact pattern): returning no params means `next build` never calls the
// backend to enumerate every blog slug at build time, so a slow/cold/
// unreachable backend during a Vercel build can't fail the build. Every
// post still renders on first request and is cached per
// `REVALIDATE_SECONDS` in `src/lib/data/live.ts`.
export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlugLive(slug);
  if (!post) return {};

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || undefined;
  const canonicalPath = post.canonicalUrl || `/blog/${post.slug}`;
  const ogImageUrl = post.ogImage?.url || post.featuredImage?.url || undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonicalPath,
      images: ogImageUrl ? [{ url: ogImageUrl }] : undefined,
      publishedTime: post.publishedAt ?? undefined,
      authors: [post.authorName],
    },
    twitter: {
      card: ogImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
  };
}

/**
 * Blog Management System (Task 4, §4/§6) — the public article detail
 * page. `getBlogPostBySlugLive` resolves to the backend's
 * `getBlogPostBySlugPublic`, which (per `blogPosts.service.ts`) only ever
 * returns a post that is PUBLISHED — a draft/scheduled/archived slug, or
 * one that doesn't exist, resolves to `null` here, which triggers
 * `notFound()` below and Next's real 404 response (requirement §6:
 * "correct HTTP status codes, including 404").
 */
export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPostBySlugLive(slug);
  if (!post) notFound();

  const { html: contentHtml, headings } = addHeadingIdsAndExtractToc(post.content);
  const showToc = headings.length >= 3;
  const publishedLabel = formatBlogDate(post.publishedAt);
  const readingLabel = formatReadingTime(post.readingTimeMinutes);
  const canonicalPath = post.canonicalUrl || `/blog/${post.slug}`;
  const canonicalUrl = canonicalPath.startsWith("http") ? canonicalPath : `${SITE_URL}${canonicalPath}`;

  const breadcrumbItems: { name: string; href?: string }[] = [
    { name: "Home", href: "/" },
    { name: "Blog", href: "/blog" },
    ...(post.category ? [{ name: post.category.name, href: `/blog?category=${post.category.slug}` }] : []),
    { name: post.title },
  ];

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.seoDescription || undefined,
    image: post.featuredImage?.url ? [post.featuredImage.url] : undefined,
    datePublished: post.publishedAt || undefined,
    author: { "@type": "Person", name: post.authorName },
    publisher: {
      "@type": "Organization",
      name: "Handyman Services",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/images/brand/handyman-logo.jpg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.href ? `${SITE_URL}${item.href}` : undefined,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <article className="py-10 sm:py-14">
        <Container className="max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
            {breadcrumbItems.map((item, index) => (
              <span key={item.name} className="flex items-center gap-1.5">
                {index > 0 && <span className="text-neutral-300">/</span>}
                {item.href ? (
                  <Link href={item.href} className="hover:text-brand-700">
                    {item.name}
                  </Link>
                ) : (
                  <span className="text-neutral-700">{item.name}</span>
                )}
              </span>
            ))}
          </nav>

          {post.category && (
            <Link
              href={`/blog?category=${post.category.slug}`}
              className="mb-3 inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"
            >
              {post.category.name}
            </Link>
          )}

          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">{post.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="user" className="h-4 w-4" />
              {post.authorName}
            </span>
            {publishedLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar" className="h-4 w-4" />
                {publishedLabel}
              </span>
            )}
            {readingLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" className="h-4 w-4" />
                {readingLabel}
              </span>
            )}
          </div>

          {post.featuredImage?.url && (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded media-library asset, arbitrary remote origin
            <img
              src={post.featuredImage.url}
              alt={post.featuredImage.alt || post.title}
              className="mt-6 w-full rounded-2xl object-cover"
            />
          )}

          {showToc && (
            <div className="mt-8">
              <TableOfContents headings={headings} />
            </div>
          )}

          <div className="mt-8">
            <BlogArticleContent html={contentHtml} />
          </div>

          {post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-6">
              <Icon name="tag" className="h-4 w-4 text-neutral-400" />
              {post.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/*
            Requirement §4's "internal links to relevant service pages" is
            primarily an authoring-time concern — the rich-text editor's
            Link tool lets a writer link any word in the body straight to
            a /[city]/[category] or /[city]/service/[slug] URL — but this
            closing CTA gives every article at least one honest, generic
            path into the catalog even when an author didn't add one
            inline, without fabricating a specific "related service" this
            page has no real data to back.
          */}
          <div className="mt-10 flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-brand-50 p-6">
            <p className="text-sm font-semibold text-neutral-800">Need a hand with this at home?</p>
            <Link
              href="/services"
              className="inline-flex shrink-0 items-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Browse Services
            </Link>
          </div>

          {post.relatedPosts.length > 0 && (
            <div className="mt-14 border-t border-neutral-200 pt-10">
              <h2 className="mb-6 text-lg font-bold text-neutral-900">Related Articles</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {post.relatedPosts.map((related) => (
                  <BlogPostCard key={related.id} post={related} />
                ))}
              </div>
            </div>
          )}
        </Container>
      </article>
    </>
  );
}

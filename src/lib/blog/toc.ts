/**
 * Blog Management System (Task 4, §4 — "table of contents for long
 * posts"). The sanitized article HTML stored on a post (`blog_posts.content`
 * — sanitized server-side on save by `backend/src/modules/blog/blogPosts.service.ts`'s
 * `sanitizeContent()`) has plain `<h2>`/`<h3>` tags with no `id` attributes:
 * the TipTap editor never writes one, since an anchor id is a reader-facing
 * concern, not an authoring one. To link a table of contents to the right
 * place in the body, this module does one pass over that HTML: it finds
 * every `<h2>`/`<h3>`, derives a URL-safe slug from its text, writes that
 * slug back as the heading's `id`, and returns both the id-annotated HTML
 * and the flat list of {id, text, level} entries the <TableOfContents>
 * component renders as anchor links.
 *
 * Deliberately regex-based rather than a new HTML-parser dependency — the
 * input is never arbitrary attacker HTML (it is this app's own sanitized,
 * server-validated rich-text output, already passed through `sanitize-html`
 * before storage), and the only transformation needed is "add an id
 * attribute to two specific tag names," which a parser would be a heavy
 * way to do. `src/app/blog/[slug]/page.tsx` is the only caller.
 */

const HEADING_PATTERN = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g;
const INNER_TAG_PATTERN = /<[^>]+>/g;

export interface BlogHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

function slugifyHeadingText(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "section";
}

/**
 * Returns the article HTML with `id` attributes injected on every H2/H3,
 * plus the ordered heading list for the table of contents. Slugs are
 * de-duplicated within a single post (second "Pricing" heading becomes
 * "pricing-2") so anchor links are always unambiguous.
 */
export function addHeadingIdsAndExtractToc(html: string): {
  html: string;
  headings: BlogHeading[];
} {
  const headings: BlogHeading[] = [];
  const slugCounts = new Map<string, number>();

  const annotated = html.replace(HEADING_PATTERN, (_match, levelStr: string, attrs: string, innerHtml: string) => {
    const level = Number(levelStr) as 2 | 3;
    const text = innerHtml.replace(INNER_TAG_PATTERN, "").trim();
    const baseSlug = slugifyHeadingText(text);
    const seenCount = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, seenCount + 1);
    const id = seenCount === 0 ? baseSlug : `${baseSlug}-${seenCount + 1}`;

    if (text) {
      headings.push({ id, text, level });
    }

    return `<h${level}${attrs} id="${id}">${innerHtml}</h${level}>`;
  });

  return { html: annotated, headings };
}

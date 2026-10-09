/**
 * Blog Management System (Task 4, §4/§9). Renders the post body's
 * already-sanitized HTML (see `backend/src/modules/blog/blogPosts.service.ts`'s
 * `sanitizeContent()`, run server-side on every create/update before the
 * row is ever written — this component never receives raw, unsanitized
 * user input) using the exact `.blog-article-content` class already
 * defined in `globals.css` to style this content, which is the same rule
 * set the admin `BlogRichTextEditor` uses for its own `.tiptap-editor
 * .ProseMirror` surface — so a published article's typography matches
 * what the author saw while writing it.
 *
 * `dangerouslySetInnerHTML` is the correct tool here, not a red flag: the
 * HTML was sanitized at write time (allowlisted tags/attributes only, no
 * `<script>`, no inline event handlers, no `javascript:` URLs), and
 * `addHeadingIdsAndExtractToc` (see `src/app/blog/[slug]/page.tsx`) only
 * adds `id` attributes to existing H2/H3 tags before this renders — it
 * never reintroduces anything unsafe.
 */
export function BlogArticleContent({ html }: { html: string }) {
  return <div className="blog-article-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

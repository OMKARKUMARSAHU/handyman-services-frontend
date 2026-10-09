/**
 * Blog Management System (Task 4, §6/§7 — SEO + sitemap): a single shared
 * absolute site origin, used anywhere an absolute URL is required (JSON-LD
 * `url`/`@id` fields, canonical/OG tags, sitemap entries) rather than a
 * relative path, which `Metadata.metadataBase` (see `src/app/layout.tsx`)
 * already resolves relative URLs against for ordinary `<meta>`/`<link>`
 * tags but does NOT apply to hand-written JSON-LD strings.
 *
 * `src/app/sitemap.ts`, `src/app/robots.ts`, and `src/app/layout.tsx` each
 * already hardcode this same literal independently (pre-existing, not
 * introduced here) — this constant is additive, not a change to those
 * files' own literals, except that `sitemap.ts` now imports this one
 * shared value instead of keeping its own separate copy (see the Blog
 * routes added there), so the two can't silently drift apart.
 */
export const SITE_URL = "https://handymanservices.in";

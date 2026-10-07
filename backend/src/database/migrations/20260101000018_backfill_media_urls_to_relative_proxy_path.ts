import type { Knex } from "knex";

/**
 * PHASE 16 FOLLOW-UP to 20260101000016 ("broken thumbnails", round 2).
 *
 * That migration rewrote every URL from the OLD raw-S3 shape to
 * `buildPublicUrl()`'s then-current shape:
 * `${API_PUBLIC_BASE_URL}${API_BASE_PATH}/media/file/<key>` -- an
 * ABSOLUTE URL built from this backend's own env vars. That looked
 * right (and does work from a server-side Node `fetch`, e.g. this very
 * migration process), but a BROWSER loading that URL as an `<img src>`
 * is a different story: the EB environment this backend runs on has no
 * HTTPS/TLS listener at all (see src/app/api/backend/[...path]/route.ts
 * on the frontend for the full writeup), so:
 *   - an `http://<eb-host>/...` URL is blocked as mixed content on the
 *     https:// Vercel frontend, and
 *   - an `https://<eb-host>/...` URL just times out -- nothing listens
 *     on 443.
 * Confirmed live: both the 4 pre-existing rows still carrying the
 * original local-dev value (`http://localhost:4000/api/v1/media/file/...`,
 * never updated to a real host at all) AND the 1 newest row with a
 * seemingly-correct `https://handyman-services-backend-env...
 * .elasticbeanstalk.com/api/v1/media/file/...` URL both fail to load as
 * a browser `<img>` -- same root cause, just two different stale/
 * unreachable absolute hosts.
 *
 * `buildPublicUrl()` (media.service.ts) now returns a site-relative
 * `/api/backend/media/file/<key>` path instead (deliberately WITHOUT
 * API_BASE_PATH -- the proxy route's own DIRECT_BACKEND_BASE_URL
 * already supplies that prefix once; including it here too produced a
 * double-prefixed, 404ing path, caught and corrected during local
 * testing), which the browser resolves against the frontend's own
 * origin and which the frontend's existing same-origin proxy
 * (`/api/backend/*`) already forwards to this backend correctly (every
 * other browser-side API call already works this way -- see
 * src/lib/auth/api.ts's request()). This migration rewrites every
 * *existing* stored URL -- of EITHER absolute shape, any host -- to
 * that same relative form, across every column/JSON field Phase 15's
 * migration covered.
 *
 * Idempotent and narrowly scoped: only rewrites a value matching
 * `^https?://<any-host>/.../media/file/<key>$`. A value already in the
 * new relative form starts with `/api/backend`, not `http`, so it never
 * matches and re-running `up` is always a no-op on top of itself.
 * Anything that was never one of this backend's own media URLs (e.g. a
 * city icon set to some unrelated external image) is left untouched.
 */

const ABSOLUTE_MEDIA_FILE_URL_PATTERN = /^https?:\/\/[^/]+(?:\/[^?#]*)?\/media\/file\/([^?#]+)$/;

function rewriteIfAbsoluteMediaFileUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(ABSOLUTE_MEDIA_FILE_URL_PATTERN);
  if (!match) return null;
  const key = match[1];
  return `/api/backend/media/file/${key}`;
}

function rewriteJsonArrayStrings(items: unknown): { changed: boolean; next: unknown } {
  if (!Array.isArray(items)) return { changed: false, next: items };
  let changed = false;
  const next = items.map((entry) => {
    if (typeof entry !== "object" || entry === null) return entry;
    const nextEntry: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
    for (const [field, fieldValue] of Object.entries(nextEntry)) {
      if (typeof fieldValue === "string") {
        const rewritten = rewriteIfAbsoluteMediaFileUrl(fieldValue);
        if (rewritten) {
          nextEntry[field] = rewritten;
          changed = true;
        }
      }
    }
    return nextEntry;
  });
  return { changed, next };
}

export async function up(knex: Knex): Promise<void> {
  async function rewriteColumn(table: string, idColumn: string, urlColumn: string): Promise<void> {
    const rows: Array<Record<string, string | null>> = await knex(table)
      .select(idColumn, urlColumn)
      .whereNotNull(urlColumn);
    for (const row of rows) {
      const next = rewriteIfAbsoluteMediaFileUrl(row[urlColumn]);
      if (next) {
        await knex(table)
          .where({ [idColumn]: row[idColumn] })
          .update({ [urlColumn]: next });
      }
    }
  }

  await rewriteColumn("media", "id", "url");
  await rewriteColumn("service_images", "id", "url");
  await rewriteColumn("categories", "id", "image");
  await rewriteColumn("products", "id", "image");
  await rewriteColumn("cities", "id", "icon_url");
  await rewriteColumn("offers", "id", "banner_image");
  await rewriteColumn("testimonials", "id", "photo");

  const sections: Array<{ key: string; image: string | null; items: unknown }> = await knex("homepage_sections").select(
    "key",
    "image",
    "items"
  );
  for (const section of sections) {
    const patch: Record<string, unknown> = {};

    const nextImage = rewriteIfAbsoluteMediaFileUrl(section.image);
    if (nextImage) patch.image = nextImage;

    const { changed, next } = rewriteJsonArrayStrings(section.items);
    if (changed) patch.items = JSON.stringify(next);

    if (Object.keys(patch).length > 0) {
      await knex("homepage_sections").where({ key: section.key }).update(patch);
    }
  }

  const branding: { id: string; logo_url: string | null; brand_assets: unknown } | undefined = await knex("branding")
    .select("id", "logo_url", "brand_assets")
    .first();
  if (branding) {
    const patch: Record<string, unknown> = {};

    const nextLogo = rewriteIfAbsoluteMediaFileUrl(branding.logo_url);
    if (nextLogo) patch.logo_url = nextLogo;

    const { changed, next } = rewriteJsonArrayStrings(branding.brand_assets);
    if (changed) patch.brand_assets = JSON.stringify(next);

    if (Object.keys(patch).length > 0) {
      await knex("branding").where({ id: branding.id }).update(patch);
    }
  }
}

export async function down(): Promise<void> {
  // Deliberately a no-op -- same reasoning as 20260101000016's down(): this
  // is a data-repair migration with no schema change to revert, and the
  // original absolute URLs were never recorded anywhere to restore. Safe
  // to re-run `up` again later if ever needed (see the idempotency note
  // in the doc comment above).
}

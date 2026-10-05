import type { Knex } from "knex";

/**
 * MEDIA FIX FOLLOW-UP ("broken thumbnails"): every URL stored before this
 * migration was built by the OLD `buildPublicUrl()` (media.service.ts),
 * which returned the S3 bucket's own
 * `https://<bucket>.s3.<region>.amazonaws.com/<key>` address — never
 * actually fetchable by a browser, since this bucket has Block Public
 * Access fully on and no bucket policy, by design
 * (PHASE_4_BACKEND_AWS_INFRASTRUCTURE_PLAN.md §9: "public access block
 * stays exactly as-is — not relaxed"). That function now returns this
 * backend's own `GET /media/file/<key>` route instead (see its doc
 * comment), which presigns a short-lived GET fresh on every request and
 * redirects — but that fix only applies to *future* uploads. This
 * migration rewrites every *existing* stored URL that still matches the
 * old S3 shape to the new route, across every column (and JSON field)
 * that has ever stored one, so already-uploaded media — the seeded
 * catalog's images, and anything uploaded through the Media Library before
 * this fix (including the two items reported broken: an uploaded image and
 * "installation-service") — start resolving too.
 *
 * Idempotent and narrowly scoped: only rewrites a value that actually
 * matches the OLD `https://<bucket>.s3.<anything>.amazonaws.com/<key>`
 * pattern. Re-running `up` after it has already applied is a no-op (a
 * rewritten URL matches the NEW route pattern, not the old one, so the
 * regex simply won't match again), and anything that was never an S3 URL
 * at all (e.g. a city icon someone set to some other external image) is
 * left completely untouched.
 */

const OLD_S3_URL_PATTERN = /^https:\/\/[^/]+\.s3[.-][^/]*\.amazonaws\.com\/(.+)$/;

function rewriteIfOldS3Url(
  value: string | null | undefined,
  apiPublicBaseUrl: string,
  apiBasePath: string
): string | null {
  if (!value) return null;
  const match = value.match(OLD_S3_URL_PATTERN);
  if (!match) return null;
  const key = match[1];
  return `${apiPublicBaseUrl}${apiBasePath}/media/file/${key}`;
}

function rewriteJsonArrayStrings(
  items: unknown,
  apiPublicBaseUrl: string,
  apiBasePath: string
): { changed: boolean; next: unknown } {
  if (!Array.isArray(items)) return { changed: false, next: items };
  let changed = false;
  const next = items.map((entry) => {
    if (typeof entry !== "object" || entry === null) return entry;
    const nextEntry: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
    for (const [field, fieldValue] of Object.entries(nextEntry)) {
      if (typeof fieldValue === "string") {
        const rewritten = rewriteIfOldS3Url(fieldValue, apiPublicBaseUrl, apiBasePath);
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
  const apiPublicBaseUrl = process.env.API_PUBLIC_BASE_URL || "http://localhost:4000";
  const apiBasePath = process.env.API_BASE_PATH || "/api/v1";

  async function rewriteColumn(table: string, idColumn: string, urlColumn: string): Promise<void> {
    const rows: Array<Record<string, string | null>> = await knex(table)
      .select(idColumn, urlColumn)
      .whereNotNull(urlColumn);
    for (const row of rows) {
      const next = rewriteIfOldS3Url(row[urlColumn], apiPublicBaseUrl, apiBasePath);
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

  // homepage_sections: a direct `image` column plus a free-form JSON
  // `items` array (e.g. a video curation's thumbnail/videoUrl per item).
  const sections: Array<{ key: string; image: string | null; items: unknown }> = await knex("homepage_sections").select(
    "key",
    "image",
    "items"
  );
  for (const section of sections) {
    const patch: Record<string, unknown> = {};

    const nextImage = rewriteIfOldS3Url(section.image, apiPublicBaseUrl, apiBasePath);
    if (nextImage) patch.image = nextImage;

    const { changed, next } = rewriteJsonArrayStrings(section.items, apiPublicBaseUrl, apiBasePath);
    if (changed) patch.items = JSON.stringify(next);

    if (Object.keys(patch).length > 0) {
      await knex("homepage_sections").where({ key: section.key }).update(patch);
    }
  }

  // branding: singleton row, logo_url column plus a JSON brand_assets array.
  const branding: { id: string; logo_url: string | null; brand_assets: unknown } | undefined = await knex("branding")
    .select("id", "logo_url", "brand_assets")
    .first();
  if (branding) {
    const patch: Record<string, unknown> = {};

    const nextLogo = rewriteIfOldS3Url(branding.logo_url, apiPublicBaseUrl, apiBasePath);
    if (nextLogo) patch.logo_url = nextLogo;

    const { changed, next } = rewriteJsonArrayStrings(branding.brand_assets, apiPublicBaseUrl, apiBasePath);
    if (changed) patch.brand_assets = JSON.stringify(next);

    if (Object.keys(patch).length > 0) {
      await knex("branding").where({ id: branding.id }).update(patch);
    }
  }
}

export async function down(): Promise<void> {
  // Deliberately a no-op: reversing would require having recorded each
  // row's original raw-S3 URL, which this data-repair migration never did
  // (there's no schema change to revert). Re-running `up` again later is
  // always safe if this ever needs to be re-applied — see the doc comment
  // above on idempotency.
}

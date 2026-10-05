import { randomUUID } from "node:crypto";
import type { Knex } from "knex";

/**
 * Central Media Library (Admin CMS follow-up — "one source of truth for
 * uploaded media" instead of each entity type running its own isolated
 * upload). Reuses the existing S3 bucket/presign architecture
 * (media.service.ts) and the project's existing per-entity tables for
 * actual rendering — this migration does NOT change how
 * categories/products/cities/offers/homepage_sections store their image
 * URLs (still a plain string column on each), so nothing that already
 * reads those columns changes behavior.
 *
 * `media` is the shared catalog of every file uploaded through the new
 * Media Library UI/picker: one row per S3 object, with reusable metadata
 * (title/SEO title/alt text/description) and an `active` flag for
 * hide-without-delete. `service_images` gets two new, nullable/defaulted
 * columns:
 *   - `media_type` ("image" | "video"): lets a service's gallery mix
 *     photos and videos (previously every row was implicitly an image).
 *     Defaults to "image" so every pre-existing row keeps its current
 *     meaning with zero data migration needed.
 *   - `media_id` (nullable FK -> media.id, ON DELETE SET NULL): when a
 *     service image was attached via the new Media Library picker, this
 *     links back to the shared library row so the same uploaded file can
 *     be reused elsewhere and so deleting it is reference-checked
 *     (media-library.service.ts's `findMediaReferences`). NULL for any
 *     image attached the old way (still fully supported) — never
 *     required, never backfilled with a guess.
 *
 * Backfill (idempotent, safe to re-run): every existing `service_images`,
 * `categories.image`, `products.image`, `cities.icon_url`,
 * `offers.banner_image`, and `homepage_sections.image` value that isn't
 * already backed by a `media` row gets ONE retroactively-created `media`
 * row (so pre-existing uploads show up in the new Library immediately,
 * per the "Existing Media Migration" requirement) — keyed by URL so the
 * same S3 object referenced from two places gets only one `media` row,
 * never duplicated. `service_images.media_id` is backfilled from this;
 * the plain string columns on categories/products/cities/offers/
 * homepage_sections are left completely untouched (no schema change on
 * those tables at all), so existing reads of those columns are
 * byte-for-byte unaffected.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("media", (t) => {
    t.uuid("id").primary();
    t.enu("type", ["image", "video"]).notNullable();
    t.string("s3_key", 1024).notNullable().unique();
    t.string("url", 500).notNullable();
    t.string("mime_type", 100).notNullable();
    t.string("original_filename", 255).notNullable();
    t.bigInteger("file_size_bytes").notNullable();
    t.string("title", 255).nullable();
    t.string("seo_title", 255).nullable();
    t.string("alt_text", 255).nullable();
    t.text("description").nullable();
    t.boolean("active").notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.index("type");
    t.index("active");
  });

  await knex.schema.alterTable("service_images", (t) => {
    t.enu("media_type", ["image", "video"]).notNullable().defaultTo("image");
    t.uuid("media_id").nullable().references("id").inTable("media").onDelete("SET NULL");
  });

  await backfillExistingMedia(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("service_images", (t) => {
    t.dropColumn("media_id");
    t.dropColumn("media_type");
  });
  await knex.schema.dropTableIfExists("media");
}

/**
 * Best-effort, idempotent backfill. Guesses `type` from the URL's file
 * extension (falls back to "image" — every pre-existing column here was
 * image-only before this migration, so that fallback is always correct
 * for data that predates video support). Guesses `mime_type` the same
 * way, for the same reason. Never throws on an individual row — a
 * malformed/unreadable legacy URL is skipped (left unbacked by a `media`
 * row, exactly as if this backfill didn't run for it) rather than failing
 * the whole migration.
 */
async function backfillExistingMedia(knex: Knex): Promise<void> {
  const mediaIdByUrl = new Map<string, string>();

  async function ensureMediaForUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    const existingId = mediaIdByUrl.get(url);
    if (existingId) return existingId;

    const type = guessType(url);
    const id = randomUUID();
    try {
      await knex("media").insert({
        id,
        type,
        // Best-effort synthetic key: these pre-existing URLs were never
        // issued through the presign flow, so there is no real S3 key on
        // record for them here. Unique per row (via the id) so the
        // column's UNIQUE constraint is always satisfiable.
        s3_key: `legacy/${id}`,
        url,
        mime_type: guessMimeType(type, url),
        original_filename: url.split("/").pop()?.slice(0, 255) || "legacy-file",
        file_size_bytes: 0,
        title: null,
        seo_title: null,
        alt_text: null,
        description: "Backfilled from pre-existing data by the Media Library migration.",
        active: true,
      });
    } catch {
      // Could not record this legacy URL (e.g. somehow already present under
      // a different id — the unique constraint is on s3_key, not url, so
      // this is only a defensive fallback). Leave it unbacked rather than
      // failing the migration.
      return null;
    }
    mediaIdByUrl.set(url, id);
    return id;
  }

  function guessType(url: string): "image" | "video" {
    return /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image";
  }

  function guessMimeType(type: "image" | "video", url: string): string {
    const ext = (url.split(".").pop() || "").split("?")[0]!.toLowerCase();
    const map: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
    };
    return map[ext] ?? (type === "video" ? "video/mp4" : "image/jpeg");
  }

  // service_images — also backfill the new media_id column so these rows
  // are immediately reference-tracked by the Media Library.
  const serviceImages: Array<{ id: string; url: string }> = await knex("service_images").select("id", "url");
  for (const row of serviceImages) {
    const mediaId = await ensureMediaForUrl(row.url);
    if (mediaId) {
      await knex("service_images").where({ id: row.id }).update({ media_id: mediaId });
    }
  }

  // Single-URL-column entities — media rows only (no schema change on
  // these tables, so nothing to link; the Media Library's reference check
  // matches these by URL directly, not by a stored media_id).
  const categories: Array<{ image: string | null }> = await knex("categories").select("image").whereNotNull("image");
  for (const row of categories) await ensureMediaForUrl(row.image);

  const products: Array<{ image: string | null }> = await knex("products").select("image").whereNotNull("image");
  for (const row of products) await ensureMediaForUrl(row.image);

  const cities: Array<{ icon_url: string | null }> = await knex("cities").select("icon_url").whereNotNull("icon_url");
  for (const row of cities) await ensureMediaForUrl(row.icon_url);

  const offers: Array<{ banner_image: string | null }> = await knex("offers").select("banner_image").whereNotNull("banner_image");
  for (const row of offers) await ensureMediaForUrl(row.banner_image);

  const sections: Array<{ image: string | null }> = await knex("homepage_sections").select("image").whereNotNull("image");
  for (const row of sections) await ensureMediaForUrl(row.image);
}

import type { Knex } from "knex";

/**
 * Blog Management System — database schema.
 *
 * Four new tables, additive only: nothing here alters, drops, or backfills
 * any existing table (cities/categories/products/services/offers/content/
 * media/etc. are completely untouched). Mirrors the exact column/slug/
 * timestamp/index conventions already established in
 * `20260101000001_create_catalog_lookup_tables.ts` (uuid PKs, unique slug
 * columns, `active`/`sort_order` on taxonomy tables, `t.timestamps(true,
 * true)`) and reuses the existing central Media Library (`media` table,
 * `20260101000015_create_media_library.ts`) for the featured image and any
 * optional social-share image — no new upload/storage infrastructure.
 *
 * `blog_categories` / `blog_tags` — deliberately separate from the
 * storefront's `categories` table. A blog category ("Home Maintenance
 * Tips", "Seasonal Guides") is an editorial concept, not a service
 * category, and conflating the two would mean a content edit could
 * accidentally affect catalog navigation (or vice-versa). Same
 * slug/name/active/sort_order shape as the existing `categories` table for
 * consistency. Tags are simpler (no hierarchy, no `active` flag — an
 * unused tag just stops being attached to anything).
 *
 * `blog_posts` — the article itself.
 *   - `content` is `LONGTEXT` (not the project's usual `TEXT`): article
 *     HTML from the rich-text editor can comfortably exceed TEXT's 64KB
 *     limit once a client is publishing several posts a week over time;
 *     LONGTEXT costs nothing extra in InnoDB until actually used.
 *   - `status` is the single source of truth for the publishing workflow
 *     (`draft` | `scheduled` | `published` | `archived`). There is no
 *     background job/cron runner anywhere in this backend (confirmed —
 *     nothing in package.json, no scheduler module), so "scheduled"
 *     cannot be flipped to "published" by a timer. Instead the service
 *     layer computes an *effective* status on every read — status is
 *     already `published`, OR status is `scheduled` and `published_at`
 *     has already passed — the same "resolve at read time" approach this
 *     codebase already uses for time-bounded offers
 *     (`20260101000012_add_offer_applicability.ts`). `published_at` is
 *     therefore dual-purpose by design: for `scheduled` it holds the
 *     future target time; once that time passes (or the post is
 *     published directly) it holds the actual go-live time, and is never
 *     moved again by an edit.
 *   - `category_id` is nullable with `ON DELETE SET NULL`, not `RESTRICT`
 *     like `products.category_id`. A storefront product genuinely
 *     requires its category; a blog post should never become
 *     un-editable/undeletable just because an editor later removes a
 *     blog category — it simply becomes uncategorized.
 *   - `author_sub` / `author_name` are denormalized, not a foreign key.
 *     This backend has no `admins` table — Admin identity is
 *     Cognito-group-only and derived from verified JWT claims at request
 *     time (see `backend/src/modules/users/users.routes.ts`'s doc
 *     comment: "Admin has no backing table"). Storing the Cognito `sub`
 *     and the display name/email captured from the token at save time is
 *     the same pattern the rest of this codebase uses whenever an
 *     admin-authored value needs attribution.
 *   - `word_count` / `reading_time_minutes` are computed and stored at
 *     save time (service layer), not computed on every read, so listing
 *     many posts never re-parses HTML just to show a reading-time badge.
 *
 * `blog_post_tags` — many-to-many join table, `CASCADE` on both sides:
 * deleting a post should remove its tag associations, and deleting a tag
 * should remove it from any post that had it, without blocking either
 * operation (unlike a post's single optional category, a tag is a much
 * lighter-weight label with no "orphaned content" concern).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("blog_categories", (t) => {
    t.uuid("id").primary();
    t.string("slug", 120).notNullable().unique();
    t.string("name", 150).notNullable();
    t.text("description").nullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.boolean("active").notNullable().defaultTo(true).index();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("blog_tags", (t) => {
    t.uuid("id").primary();
    t.string("slug", 120).notNullable().unique();
    t.string("name", 100).notNullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("blog_posts", (t) => {
    t.uuid("id").primary();
    t.string("slug", 160).notNullable().unique();
    t.string("title", 255).notNullable();
    t.text("excerpt").nullable();
    t.text("content", "longtext").notNullable();

    t.uuid("featured_image_media_id").nullable().references("id").inTable("media").onDelete("SET NULL");
    t.string("featured_image_alt", 255).nullable();
    t.uuid("og_image_media_id").nullable().references("id").inTable("media").onDelete("SET NULL");

    t.uuid("category_id").nullable().references("id").inTable("blog_categories").onDelete("SET NULL");

    // Denormalized author attribution — see file-level doc comment above.
    t.string("author_sub", 255).notNullable();
    t.string("author_name", 150).notNullable();

    t.enu("status", ["draft", "scheduled", "published", "archived"]).notNullable().defaultTo("draft").index();
    // Dual-purpose: target time while `scheduled`, actual go-live time once
    // published (directly or via the scheduled time passing). See file-level
    // doc comment for the "effective status" read-time resolution this backs.
    t.timestamp("published_at").nullable().index();
    t.timestamp("archived_at").nullable();

    t.string("seo_title", 255).nullable();
    t.string("seo_description", 500).nullable();
    t.string("canonical_url", 500).nullable();

    t.integer("word_count").nullable();
    t.integer("reading_time_minutes").nullable();

    t.timestamps(true, true);

    t.index("category_id");
  });

  await knex.schema.createTable("blog_post_tags", (t) => {
    t.uuid("post_id").notNullable().references("id").inTable("blog_posts").onDelete("CASCADE");
    t.uuid("tag_id").notNullable().references("id").inTable("blog_tags").onDelete("CASCADE");
    t.primary(["post_id", "tag_id"]);
    t.index("tag_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("blog_post_tags");
  await knex.schema.dropTableIfExists("blog_posts");
  await knex.schema.dropTableIfExists("blog_tags");
  await knex.schema.dropTableIfExists("blog_categories");
}

import type { Knex } from "knex";

/**
 * Admin content/branding tables — PHASE_2_BACKEND_DATABASE_SCHEMA.md §7
 * content-tables note, and the Phase 3 brief's "Admin Panel" §6 (homepage
 * content, FAQs, contact info, promotional banners, branding). Direct ports
 * of the existing src/types/index.ts shapes (Testimonial, FAQ, ContactInfo,
 * HomepageSection, NavItem) plus a small new `branding` singleton table for
 * the logo/brand-asset references the brief explicitly asks for, which has
 * no prior type in the mock frontend. Built because the brief's Admin Panel
 * section names this scope directly, resolving Open Question #20 in favor
 * of "yes, in scope" for Phase 3's implementation.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("testimonials", (t) => {
    t.uuid("id").primary();
    t.string("name", 150).notNullable();
    t.string("city", 100).notNullable();
    t.string("plan_id", 36).nullable();
    t.integer("rating").notNullable();
    t.text("quote").notNullable();
    t.string("photo", 500).nullable();
    t.boolean("approved").notNullable().defaultTo(false).index();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.timestamps(true, true);
  });
  await knex.schema.raw("ALTER TABLE testimonials ADD CONSTRAINT chk_testimonials_rating_range CHECK (rating BETWEEN 1 AND 5)");

  await knex.schema.createTable("faqs", (t) => {
    t.uuid("id").primary();
    t.string("question", 500).notNullable();
    t.text("answer").notNullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.string("category", 100).nullable();
    t.boolean("answer_confirmed").notNullable().defaultTo(false);
    t.timestamps(true, true);
  });

  // Singleton row (id = 'singleton') — one contact-info record for the whole site.
  await knex.schema.createTable("contact_info", (t) => {
    t.string("id", 36).primary();
    t.string("phone", 20).notNullable();
    t.string("whatsapp", 20).notNullable();
    t.string("email", 255).nullable();
    t.string("address", 500).nullable();
    t.string("hours", 255).nullable();
    t.json("social_links").notNullable(); // [{ platform, url }]
    t.timestamps(true, true);
  });

  await knex.schema.createTable("homepage_sections", (t) => {
    t.string("key", 100).primary();
    t.string("heading", 255).notNullable();
    t.string("subheading", 500).nullable();
    t.text("body").nullable();
    t.string("cta_text", 100).nullable();
    t.string("cta_link", 255).nullable();
    t.json("items").nullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.string("image", 500).nullable();
    t.string("image_alt", 255).nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("nav_items", (t) => {
    t.uuid("id").primary();
    t.string("label", 100).notNullable();
    t.string("href", 255).notNullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.timestamps(true, true);
  });

  // Singleton row (id = 'singleton') — logo + brand asset references.
  await knex.schema.createTable("branding", (t) => {
    t.string("id", 36).primary();
    t.string("logo_url", 500).nullable();
    t.string("logo_alt", 255).nullable();
    t.json("brand_assets").nullable(); // [{ key, url, alt }] for any additional asset
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("branding");
  await knex.schema.dropTableIfExists("nav_items");
  await knex.schema.dropTableIfExists("homepage_sections");
  await knex.schema.dropTableIfExists("contact_info");
  await knex.schema.dropTableIfExists("faqs");
  await knex.schema.dropTableIfExists("testimonials");
}

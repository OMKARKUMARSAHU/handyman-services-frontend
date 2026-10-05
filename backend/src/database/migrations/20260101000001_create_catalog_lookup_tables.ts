import type { Knex } from "knex";

/**
 * cities, categories, products, service_types — PHASE_2_BACKEND_DATABASE_SCHEMA.md §7.
 * Direct ports of the existing, approved City/Category/Product/ServiceType
 * shapes from src/types/index.ts — not redesigned.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("cities", (t) => {
    t.uuid("id").primary();
    t.string("name", 100).notNullable();
    t.string("state", 100).notNullable();
    t.string("slug", 120).notNullable().unique();
    t.boolean("is_popular").notNullable().defaultTo(false);
    t.boolean("active").notNullable().defaultTo(true).index();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.string("icon_url", 500).nullable();
    t.string("icon_alt", 255).nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("categories", (t) => {
    t.uuid("id").primary();
    t.string("slug", 120).notNullable().unique();
    t.string("name", 150).notNullable();
    t.text("description").notNullable();
    t.string("icon", 100).notNullable();
    t.string("image", 500).nullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.boolean("active").notNullable().defaultTo(true).index();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("products", (t) => {
    t.uuid("id").primary();
    t.uuid("category_id").notNullable().references("id").inTable("categories").onDelete("RESTRICT");
    t.string("slug", 120).notNullable().unique();
    t.string("name", 150).notNullable();
    t.text("description").notNullable();
    t.string("icon", 100).notNullable();
    t.string("image", 500).nullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.boolean("active").notNullable().defaultTo(true).index();
    t.timestamps(true, true);
    t.index("category_id");
  });

  await knex.schema.createTable("service_types", (t) => {
    t.uuid("id").primary();
    t.string("key", 50).notNullable().unique();
    t.string("label", 100).notNullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.boolean("active").notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("service_types");
  await knex.schema.dropTableIfExists("products");
  await knex.schema.dropTableIfExists("categories");
  await knex.schema.dropTableIfExists("cities");
}

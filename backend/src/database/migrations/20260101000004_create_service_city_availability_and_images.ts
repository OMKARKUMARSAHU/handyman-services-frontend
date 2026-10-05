import type { Knex } from "knex";

/**
 * service_city_availability, service_images — PHASE_2_BACKEND_DATABASE_SCHEMA.md §7 §11.
 * A service exists once; which cities it's offered in is a relationship,
 * never a duplicated Service row (PHASE_2_DATA_ARCHITECTURE.md §5, carried
 * forward unchanged).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("service_city_availability", (t) => {
    t.uuid("id").primary();
    t.uuid("service_id").notNullable().references("id").inTable("services").onDelete("CASCADE");
    t.uuid("city_id").notNullable().references("id").inTable("cities").onDelete("CASCADE");
    t.boolean("active").notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(["service_id", "city_id"]);
  });

  await knex.schema.createTable("service_images", (t) => {
    t.uuid("id").primary();
    t.uuid("service_id").notNullable().references("id").inTable("services").onDelete("CASCADE");
    t.string("url", 500).notNullable();
    t.string("alt", 255).notNullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.index("service_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("service_images");
  await knex.schema.dropTableIfExists("service_city_availability");
}

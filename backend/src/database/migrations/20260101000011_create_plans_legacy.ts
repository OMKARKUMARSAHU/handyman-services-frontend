import type { Knex } from "knex";

/**
 * plans — legacy Silver/Gold/Platinum subscription entity, retained
 * unmodified per the client's existing "LEGACY / PENDING CLIENT DECISION"
 * instruction (PHASE_2_BACKEND_DATABASE_SCHEMA.md §6). Not rebuilt, not
 * removed, not linked into the primary catalog architecture.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("plans", (t) => {
    t.uuid("id").primary();
    t.string("name", 100).notNullable();
    t.decimal("price", 10, 2).notNullable();
    t.string("currency", 10).notNullable().defaultTo("INR");
    t.string("billing_period", 20).notNullable();
    t.text("description").notNullable();
    t.integer("visits").notNullable();
    // applianceCount: number | "all" — stored as a string to preserve both shapes losslessly.
    t.string("appliance_count", 20).notNullable();
    t.json("appliance_ids").notNullable(); // string[] | "all" encoded as JSON
    t.json("features").notNullable();
    t.string("badge", 100).nullable();
    t.string("cta_text", 100).notNullable();
    t.boolean("available").notNullable().defaultTo(true);
    t.integer("sort_order").notNullable().defaultTo(0);
    t.boolean("price_confirmed").notNullable().defaultTo(false);
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("plans");
}

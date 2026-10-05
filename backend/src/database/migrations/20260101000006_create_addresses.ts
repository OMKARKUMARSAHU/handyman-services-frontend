import type { Knex } from "knex";

/** addresses — PHASE_2_BACKEND_DATABASE_SCHEMA.md §7. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("addresses", (t) => {
    t.uuid("id").primary();
    t.uuid("customer_id").nullable().references("id").inTable("customers").onDelete("CASCADE");
    t.string("label", 50).notNullable();
    t.string("line1", 255).notNullable();
    t.string("line2", 255).nullable();
    t.string("city", 100).notNullable();
    t.string("state", 100).notNullable();
    t.string("pincode", 10).notNullable();
    t.boolean("is_default").notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.index("customer_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("addresses");
}

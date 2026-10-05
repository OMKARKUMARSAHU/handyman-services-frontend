import type { Knex } from "knex";

/**
 * offers — PHASE_2_BACKEND_DATABASE_SCHEMA.md §7 §10.
 * `applies_to_ids` is a JSON array interpreted against `applies_to_scope`
 * at read time — deliberately not a real FK (the column means different
 * things depending on scope). Never auto-combined with a Service's own
 * mrp/offerPrice discount (Open Question #25, still TBD).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("offers", (t) => {
    t.uuid("id").primary();
    t.string("title", 150).notNullable();
    t.text("description").notNullable();
    t.enu("discount_type", ["percent", "flat"]).notNullable();
    t.decimal("discount_value", 10, 2).notNullable();
    t.enu("applies_to_scope", ["all", "category", "service"]).notNullable();
    t.json("applies_to_ids").notNullable();
    t.string("banner_image", 500).nullable();
    t.date("start_date").nullable();
    t.date("end_date").nullable();
    t.boolean("active").notNullable().defaultTo(true).index();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("offers");
}

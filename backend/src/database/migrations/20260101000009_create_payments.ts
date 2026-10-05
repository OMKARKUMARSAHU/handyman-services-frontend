import type { Knex } from "knex";

/**
 * payments — PHASE_2_BACKEND_DATABASE_SCHEMA.md §7 §14. Boundary/abstraction
 * only: generic, gateway-agnostic lifecycle, `provider` left nullable since
 * no gateway is selected (TBD / CLIENT CONFIRMATION REQUIRED). No
 * gateway-specific column (card data, UPI VPA, etc.) exists here.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("payments", (t) => {
    t.uuid("id").primary();
    t.uuid("order_id").notNullable().references("id").inTable("orders").onDelete("RESTRICT");
    t.decimal("amount", 10, 2).notNullable();
    t.enu("status", ["initiated", "succeeded", "failed", "refunded"]).notNullable().defaultTo("initiated");
    t.string("provider", 50).nullable();
    t.string("provider_reference", 255).nullable();
    t.string("idempotency_key", 100).notNullable().unique();
    t.timestamps(true, true);
    t.index("order_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payments");
}

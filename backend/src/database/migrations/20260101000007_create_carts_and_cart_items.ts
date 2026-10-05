import type { Knex } from "knex";

/**
 * carts, cart_items — PHASE_2_BACKEND_DATABASE_SCHEMA.md §12, Design A
 * (hybrid), now finalized by the Phase 3 brief: anonymous browsing keeps
 * the cart purely client-local (localStorage, unchanged from today's
 * frontend) — these tables exist ONLY for the authenticated half, created
 * for a customer at login/merge time, never for a guest.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("carts", (t) => {
    t.uuid("id").primary();
    t.uuid("customer_id").notNullable().unique().references("id").inTable("customers").onDelete("CASCADE");
    t.timestamps(true, true);
  });

  await knex.schema.createTable("cart_items", (t) => {
    t.uuid("id").primary();
    t.uuid("cart_id").notNullable().references("id").inTable("carts").onDelete("CASCADE");
    t.uuid("service_id").notNullable().references("id").inTable("services").onDelete("RESTRICT");
    t.uuid("city_id").notNullable().references("id").inTable("cities").onDelete("RESTRICT");
    t.integer("quantity").notNullable();
    t.decimal("unit_price_at_add", 10, 2).notNullable();
    t.timestamps(true, true);
    t.index("cart_id");
    t.unique(["cart_id", "service_id", "city_id"]);
  });

  await knex.schema.raw("ALTER TABLE cart_items ADD CONSTRAINT chk_cart_items_quantity_positive CHECK (quantity > 0)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("cart_items");
  await knex.schema.dropTableIfExists("carts");
}

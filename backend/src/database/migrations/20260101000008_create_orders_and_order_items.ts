import type { Knex } from "knex";

/**
 * orders, order_items — PHASE_2_BACKEND_DATABASE_SCHEMA.md §7 §10 §13.
 * Address and pricing are SNAPSHOTTED (columns copied at creation time,
 * never a live re-read) so a later Admin price edit or Customer address
 * edit can never rewrite a historical order — the brief's explicit
 * requirement. `customer_id` is NOT NULL here: the Phase 3 brief finalizes
 * "an unauthenticated user must not be able to create an order," resolving
 * the previously-open guest-checkout question (Open Question #17) in favor
 * of login-required-at-checkout.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("orders", (t) => {
    t.uuid("id").primary();
    t.string("order_number", 30).notNullable().unique();
    t.uuid("customer_id").notNullable().references("id").inTable("customers").onDelete("RESTRICT");

    t.string("address_label", 50).notNullable();
    t.string("address_line1", 255).notNullable();
    t.string("address_line2", 255).nullable();
    t.string("address_city", 100).notNullable();
    t.string("address_state", 100).notNullable();
    t.string("address_pincode", 10).notNullable();

    t.date("scheduled_date").notNullable();
    t.string("scheduled_slot", 50).nullable();

    t.decimal("subtotal", 10, 2).notNullable();
    t.decimal("discount_total", 10, 2).notNullable();
    t.decimal("total", 10, 2).notNullable();

    t.enu("status", ["pending", "confirmed", "assigned", "in_progress", "completed", "cancelled"])
      .notNullable()
      .defaultTo("pending");
    t.uuid("provider_id").nullable().references("id").inTable("service_providers").onDelete("SET NULL");
    t.string("payment_status", 30).notNullable().defaultTo("not_applicable");
    t.string("idempotency_key", 100).notNullable().unique();

    t.timestamps(true, true);

    t.index("customer_id");
    t.index("status");
    t.index("provider_id");
  });

  await knex.schema.createTable("order_items", (t) => {
    t.uuid("id").primary();
    t.uuid("order_id").notNullable().references("id").inTable("orders").onDelete("CASCADE");
    t.uuid("service_id").notNullable().references("id").inTable("services").onDelete("RESTRICT");
    t.string("service_name_snapshot", 200).notNullable();
    t.integer("quantity").notNullable();
    t.decimal("unit_price", 10, 2).notNullable();
    t.decimal("line_total", 10, 2).notNullable();
    t.timestamps(true, true);
    t.index("order_id");
  });

  await knex.schema.raw("ALTER TABLE order_items ADD CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("order_items");
  await knex.schema.dropTableIfExists("orders");
}

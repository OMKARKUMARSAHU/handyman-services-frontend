import type { Knex } from "knex";

/**
 * services — PHASE_2_BACKEND_DATABASE_SCHEMA.md §7 §9.
 * Core, extended entity: the existing Service shape plus the
 * approval/ownership fields a real multi-role backend needs
 * (approval_status, rejection_reason, approved_by_user_id, approved_at,
 * created_by_role, created_by_user_id). `created_by_user_id` is
 * app-enforced polymorphic (a customers/service_providers id is never the
 * creator — only admin or provider create listings — so it is NOT a
 * customers FK; see schema doc's own note on why there is no single DB-level
 * FK here) and `approved_by_user_id` stores the approving Admin's Cognito
 * `sub` directly (no dedicated `admins` table exists — see schema doc note).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("services", (t) => {
    t.uuid("id").primary();
    t.string("slug", 160).notNullable().unique();
    t.uuid("product_id").notNullable().references("id").inTable("products").onDelete("RESTRICT");
    t.uuid("service_type_id").notNullable().references("id").inTable("service_types").onDelete("RESTRICT");
    t.string("name", 200).notNullable();
    t.string("short_description", 500).notNullable();
    t.text("description").notNullable();
    t.json("whats_included").notNullable();
    t.decimal("mrp", 10, 2).notNullable();
    t.decimal("offer_price", 10, 2).notNullable();
    t.decimal("rating_average", 2, 1).nullable();
    t.integer("rating_count").notNullable().defaultTo(0);
    t.boolean("is_most_booked").notNullable().defaultTo(false);
    t.boolean("featured").notNullable().defaultTo(false);
    t.boolean("active").notNullable().defaultTo(true);
    t.integer("sort_order").notNullable().defaultTo(0);

    t.enu("approval_status", ["pending_approval", "approved", "rejected"]).notNullable().defaultTo("pending_approval");
    t.string("rejection_reason", 1000).nullable();
    t.string("approved_by_user_id", 100).nullable();
    t.datetime("approved_at").nullable();
    t.enu("created_by_role", ["admin", "provider"]).notNullable();
    t.string("created_by_user_id", 36).notNullable();

    t.timestamps(true, true);

    t.index("product_id");
    t.index("service_type_id");
    t.index("active");
    t.index("approval_status");
    t.index("created_by_user_id");
  });

  await knex.schema.raw(
    "ALTER TABLE services ADD CONSTRAINT chk_services_mrp_nonnegative CHECK (mrp >= 0)"
  );
  await knex.schema.raw(
    "ALTER TABLE services ADD CONSTRAINT chk_services_offer_price_nonnegative CHECK (offer_price >= 0)"
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("services");
}

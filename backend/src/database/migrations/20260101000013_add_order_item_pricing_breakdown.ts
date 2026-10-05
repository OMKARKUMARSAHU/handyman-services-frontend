import type { Knex } from "knex";

/**
 * PHASE 3 CORRECTION — order_items must snapshot the FULL pricing
 * breakdown (mrp, service-level discount, the one effective Offer, and the
 * combined discount), not just the final unit price, so a historical order
 * remains fully explainable even after the service's price or an Offer is
 * later changed or removed. `effective_offer_id` is a nullable FK with
 * ON DELETE SET NULL — if the referenced Offer is ever deleted, the LINK
 * is lost but the historical NAME/applicability are preserved in their own
 * snapshot columns, so the order's own display is never affected by it.
 *
 * `unit_price`/`line_total` (added in migration 000008) keep their
 * existing meaning and column names — the FINAL price actually charged —
 * preserving the existing API contract's field names; this migration only
 * ADDS the breakdown that explains how that final price was reached.
 *
 * Backfill: existing `order_items` rows (none exist in the real RDS
 * instance — see PHASE_3_BACKEND_IMPLEMENTATION.md §16 — and only
 * disposable local rows exist elsewhere) have their new
 * `mrp_snapshot`/`service_offer_price_snapshot` columns backfilled from
 * the already-stored `unit_price`, which is the only historically-known
 * price figure for a row created before this correction. This is a
 * best-effort, non-destructive backfill, not a reinterpretation of money
 * already charged.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("order_items", (t) => {
    t.decimal("mrp_snapshot", 10, 2).nullable();
    t.decimal("service_offer_price_snapshot", 10, 2).nullable();
    t.decimal("service_discount_amount", 10, 2).notNullable().defaultTo(0);
    t.uuid("effective_offer_id").nullable();
    t.string("effective_offer_name_snapshot", 150).nullable();
    t.enu("effective_offer_applicability_type_snapshot", ["all_india", "city"]).nullable();
    t.decimal("offer_discount_amount", 10, 2).notNullable().defaultTo(0);
    t.decimal("total_discount_amount", 10, 2).notNullable().defaultTo(0);
  });

  // Best-effort backfill for any pre-existing rows (disposable local DBs only).
  await knex("order_items").update({
    mrp_snapshot: knex.raw("unit_price"),
    service_offer_price_snapshot: knex.raw("unit_price"),
  });

  await knex.schema.alterTable("order_items", (t) => {
    t.decimal("mrp_snapshot", 10, 2).notNullable().alter();
    t.decimal("service_offer_price_snapshot", 10, 2).notNullable().alter();
    t.foreign("effective_offer_id", "fk_order_items_effective_offer").references("id").inTable("offers").onDelete("SET NULL");
    t.index("effective_offer_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("order_items", (t) => {
    t.dropForeign(["effective_offer_id"], "fk_order_items_effective_offer");
    t.dropIndex(["effective_offer_id"]);
    t.dropColumn("mrp_snapshot");
    t.dropColumn("service_offer_price_snapshot");
    t.dropColumn("service_discount_amount");
    t.dropColumn("effective_offer_id");
    t.dropColumn("effective_offer_name_snapshot");
    t.dropColumn("effective_offer_applicability_type_snapshot");
    t.dropColumn("offer_discount_amount");
    t.dropColumn("total_discount_amount");
  });
}

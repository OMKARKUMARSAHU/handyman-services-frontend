import type { Knex } from "knex";

/**
 * City-wise pricing for SERVICES (not the Shop — Shop products keep their own
 * `shop_product_cities` / `shop_city_pricing` tables, untouched).
 *
 * Additive and reversible: two NULLABLE columns on the existing
 * `service_city_availability` table (one row per service x city that already
 * stores that city's availability), plus CHECK constraints. No row, no
 * service and no existing column is altered, so every current service keeps
 * resolving to its base `services.mrp` / `services.offer_price`.
 *
 * Semantics:
 * - `mrp` and `offer_price` both NULL  = "use the service's base prices" (the
 *   default for every existing row and for every city with no custom price).
 * - both set                           = this city's own MRP / offer price.
 * - exactly one set is rejected by `chk_sca_price_pair`, because a lone
 *   offer price with no MRP (or vice versa) has no defined meaning.
 * - values must be >= 0 and the offer price may not exceed the MRP.
 *
 * Pricing never decides availability: a city's `active` flag is untouched by
 * this migration and by saving prices (the pricing API inserts new rows with
 * `active = false`).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("service_city_availability", (t) => {
    t.decimal("mrp", 10, 2).nullable();
    t.decimal("offer_price", 10, 2).nullable();
  });
  await knex.schema.raw(
    "ALTER TABLE service_city_availability ADD CONSTRAINT chk_sca_price_pair CHECK ((mrp IS NULL AND offer_price IS NULL) OR (mrp IS NOT NULL AND offer_price IS NOT NULL))"
  );
  await knex.schema.raw(
    "ALTER TABLE service_city_availability ADD CONSTRAINT chk_sca_price_range CHECK (mrp IS NULL OR (mrp >= 0 AND offer_price >= 0 AND offer_price <= mrp))"
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw("ALTER TABLE service_city_availability DROP CHECK chk_sca_price_range");
  await knex.schema.raw("ALTER TABLE service_city_availability DROP CHECK chk_sca_price_pair");
  await knex.schema.alterTable("service_city_availability", (t) => {
    t.dropColumn("offer_price");
    t.dropColumn("mrp");
  });
}

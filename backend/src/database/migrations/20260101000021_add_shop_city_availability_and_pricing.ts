import type { Knex } from "knex";

/**
 * City-wise availability and pricing for the e-commerce Products section.
 * Additive only: three new objects and one nullable column on a table this
 * feature itself created (`shop_orders`). No existing service/catalog table is
 * altered.
 *
 * - shop_product_cities: per product x city override. No row = the product is
 *   available in that city at the base price (so every existing product keeps
 *   working). `available = false` hides/blocks it in that city;
 *   `price_override` (nullable) replaces the computed price there.
 * - shop_city_pricing: one optional percentage adjustment per city applied to
 *   the base price of products that have no explicit override for that city.
 * - shop_orders.city_id: the city the order was priced for (audit only).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("shop_product_cities", (t) => {
    t.uuid("id").primary();
    t.uuid("product_id").notNullable().references("id").inTable("shop_products").onDelete("CASCADE");
    t.uuid("city_id").notNullable().references("id").inTable("cities").onDelete("CASCADE");
    t.boolean("available").notNullable().defaultTo(true);
    t.decimal("price_override", 10, 2).nullable();
    t.timestamps(true, true);
    t.unique(["product_id", "city_id"]);
    t.index("city_id");
  });

  await knex.schema.createTable("shop_city_pricing", (t) => {
    t.uuid("city_id").primary().references("id").inTable("cities").onDelete("CASCADE");
    // Signed percentage, e.g. 10.00 = +10%, -5.00 = -5%.
    t.decimal("product_price_adjust_percent", 6, 2).notNullable().defaultTo(0);
    t.timestamps(true, true);
  });

  await knex.schema.alterTable("shop_orders", (t) => {
    t.uuid("city_id").nullable().references("id").inTable("cities").onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("shop_orders", (t) => {
    t.dropForeign(["city_id"]);
    t.dropColumn("city_id");
  });
  await knex.schema.dropTableIfExists("shop_city_pricing");
  await knex.schema.dropTableIfExists("shop_product_cities");
}

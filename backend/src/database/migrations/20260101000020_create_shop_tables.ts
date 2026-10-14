import type { Knex } from "knex";

/**
 * E-commerce "Products" section — database schema.
 *
 * Additive only: nothing here alters, drops, or backfills any existing table.
 * All tables use the `shop_` prefix because the pre-existing `products` table
 * means "appliance type under a service category" (a service-catalogue concept),
 * NOT a purchasable good. Keeping the namespaces separate means a shop edit can
 * never affect service navigation, pricing or booking, and vice versa.
 *
 * Reuses (by foreign key, never by copy): `customers` (order ownership) and
 * `media` (product images / uploaded videos live in S3 via the central Media
 * Library; only references are stored here, never file bytes).
 *
 * Money: DECIMAL(10,2) everywhere. Orders SNAPSHOT name/sku/price/address so a
 * later catalogue or address edit never rewrites history.
 *
 * Fulfilment status (`shop_orders.status`) and payment status
 * (`shop_orders.payment_status`) are deliberately separate columns: an admin
 * moving an order along the fulfilment pipeline can never mark a payment as
 * gateway-verified.
 *
 * `shop_payment_events.provider_event_id` is UNIQUE: that is what makes webhook
 * processing idempotent (a replayed event hits the unique key and is ignored).
 *
 * Fully reversible: `down()` drops only these tables, children first.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("shop_categories", (t) => {
    t.uuid("id").primary();
    t.string("slug", 120).notNullable().unique();
    t.string("name", 150).notNullable();
    t.text("description").nullable();
    t.string("image_url", 500).nullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.boolean("active").notNullable().defaultTo(true).index();
    t.string("seo_title", 255).nullable();
    t.string("seo_description", 500).nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("shop_products", (t) => {
    t.uuid("id").primary();
    t.uuid("category_id").notNullable().references("id").inTable("shop_categories").onDelete("RESTRICT");
    t.string("slug", 160).notNullable().unique();
    t.string("sku", 80).notNullable().unique();
    t.string("name", 255).notNullable();
    t.string("short_description", 500).nullable();
    t.text("description").nullable();
    t.decimal("price", 10, 2).notNullable();
    t.decimal("mrp", 10, 2).nullable();
    t.integer("stock_quantity").notNullable().defaultTo(0);
    t.integer("low_stock_threshold").notNullable().defaultTo(5);
    t.boolean("track_inventory").notNullable().defaultTo(true);
    // draft = never public; published = public only while `active` is also true.
    t.enu("status", ["draft", "published"]).notNullable().defaultTo("draft");
    t.boolean("active").notNullable().defaultTo(true);
    t.boolean("featured").notNullable().defaultTo(false);
    t.json("specifications").nullable();
    t.json("compatible_models").nullable();
    t.text("delivery_info").nullable();
    t.text("return_info").nullable();
    t.string("seo_title", 255).nullable();
    t.string("seo_description", 500).nullable();
    t.boolean("is_demo").notNullable().defaultTo(false);
    t.timestamps(true, true);

    t.index(["category_id", "status", "active"]);
    t.index("created_at");
    t.index("featured");
  });

  await knex.schema.createTable("shop_product_images", (t) => {
    t.uuid("id").primary();
    t.uuid("product_id").notNullable().references("id").inTable("shop_products").onDelete("CASCADE");
    t.uuid("media_id").notNullable().references("id").inTable("media").onDelete("RESTRICT");
    t.string("alt_text", 255).nullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.boolean("is_primary").notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.index(["product_id", "sort_order"]);
    t.index("media_id");
  });

  await knex.schema.createTable("shop_product_videos", (t) => {
    t.uuid("id").primary();
    t.uuid("product_id").notNullable().references("id").inTable("shop_products").onDelete("CASCADE");
    t.enu("kind", ["youtube", "upload"]).notNullable();
    // 11-character YouTube id, parsed + validated server-side (never a raw URL).
    t.string("youtube_id", 20).nullable();
    t.uuid("media_id").nullable().references("id").inTable("media").onDelete("RESTRICT");
    t.string("title", 255).nullable();
    t.integer("sort_order").notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.index(["product_id", "sort_order"]);
    t.index("media_id");
  });

  await knex.schema.createTable("shop_settings", (t) => {
    t.string("key", 80).primary();
    t.text("value").nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("shop_orders", (t) => {
    t.uuid("id").primary();
    t.string("order_number", 40).notNullable().unique();
    t.uuid("customer_id").notNullable().references("id").inTable("customers").onDelete("RESTRICT");
    t.enu("status", ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"])
      .notNullable()
      .defaultTo("pending_payment")
      .index();
    t.enu("payment_status", ["unpaid", "pending", "paid", "failed", "refunded"]).notNullable().defaultTo("unpaid").index();
    t.decimal("subtotal", 10, 2).notNullable();
    t.decimal("delivery_charge", 10, 2).notNullable().defaultTo(0);
    t.decimal("total", 10, 2).notNullable();
    // Address snapshot — later address edits never change a placed order.
    t.string("ship_name", 150).notNullable();
    t.string("ship_phone", 30).nullable();
    t.string("ship_line1", 255).notNullable();
    t.string("ship_line2", 255).nullable();
    t.string("ship_city", 120).notNullable();
    t.string("ship_state", 120).notNullable();
    t.string("ship_pincode", 12).notNullable();
    t.string("idempotency_key", 100).notNullable().unique();
    t.string("tracking_carrier", 120).nullable();
    t.string("tracking_number", 120).nullable();
    t.timestamp("shipped_at").nullable();
    t.timestamp("delivered_at").nullable();
    t.timestamp("cancelled_at").nullable();
    t.string("cancel_reason", 500).nullable();
    t.boolean("stock_restored").notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.index(["customer_id", "created_at"]);
    t.index("created_at");
  });

  await knex.schema.createTable("shop_order_items", (t) => {
    t.uuid("id").primary();
    t.uuid("order_id").notNullable().references("id").inTable("shop_orders").onDelete("CASCADE");
    t.uuid("product_id").nullable().references("id").inTable("shop_products").onDelete("SET NULL");
    t.string("product_name", 255).notNullable();
    t.string("product_sku", 80).notNullable();
    t.string("product_slug", 160).nullable();
    t.string("image_url", 500).nullable();
    t.decimal("unit_price", 10, 2).notNullable();
    t.integer("quantity").notNullable();
    t.decimal("line_total", 10, 2).notNullable();
    t.timestamps(true, true);
    t.index("order_id");
    t.index("product_id");
  });

  await knex.schema.createTable("shop_payments", (t) => {
    t.uuid("id").primary();
    t.uuid("order_id").notNullable().references("id").inTable("shop_orders").onDelete("CASCADE");
    t.string("provider", 30).notNullable().defaultTo("razorpay");
    t.string("provider_order_id", 80).notNullable().unique();
    t.string("provider_payment_id", 80).nullable().index();
    t.decimal("amount", 10, 2).notNullable();
    t.enu("status", ["initiated", "succeeded", "failed"]).notNullable().defaultTo("initiated");
    // True only when HMAC verification (browser callback OR webhook) passed server-side.
    t.boolean("signature_verified").notNullable().defaultTo(false);
    t.string("failure_reason", 500).nullable();
    t.timestamps(true, true);
    t.index("order_id");
  });

  await knex.schema.createTable("shop_payment_events", (t) => {
    t.uuid("id").primary();
    t.string("provider_event_id", 120).notNullable().unique();
    t.string("event_type", 80).notNullable();
    t.json("payload").nullable();
    t.timestamp("processed_at").nullable();
    t.string("result", 120).nullable();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("shop_payment_events");
  await knex.schema.dropTableIfExists("shop_payments");
  await knex.schema.dropTableIfExists("shop_order_items");
  await knex.schema.dropTableIfExists("shop_orders");
  await knex.schema.dropTableIfExists("shop_settings");
  await knex.schema.dropTableIfExists("shop_product_videos");
  await knex.schema.dropTableIfExists("shop_product_images");
  await knex.schema.dropTableIfExists("shop_products");
  await knex.schema.dropTableIfExists("shop_categories");
}

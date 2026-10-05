import { getDb } from "../../src/database/db";

/**
 * Every table this schema defines, truncated between tests so each test
 * starts from a clean, empty database — never the real RDS instance, only
 * the disposable local `handyman_test` MySQL database (see
 * src/database/knexfile.ts's `test` profile / PHASE_3_BACKEND_IMPLEMENTATION.md
 * "Database Safety"). `knex_migrations*` is deliberately excluded so schema
 * history is never touched by test runs.
 */
const ALL_TABLES = [
  "payments",
  "order_items",
  "orders",
  "cart_items",
  "carts",
  "addresses",
  "service_images",
  "service_city_availability",
  "offers",
  "services",
  "products",
  "categories",
  "service_types",
  "cities",
  "service_providers",
  "customers",
  "testimonials",
  "faqs",
  "contact_info",
  "homepage_sections",
  "nav_items",
  "branding",
  "plans",
];

export async function resetDatabase(): Promise<void> {
  const db = getDb();
  await db.raw("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const table of ALL_TABLES) {
      await db(table).truncate();
    }
  } finally {
    await db.raw("SET FOREIGN_KEY_CHECKS = 1");
  }
}

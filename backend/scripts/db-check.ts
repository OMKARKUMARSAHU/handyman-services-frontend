/**
 * READ-ONLY database check:  npm run db:check
 * Prints which database this backend is configured to use (never the password), what the server
 * really is (RDS or a local MySQL), and which migrations are applied/pending. Changes nothing.
 */
import { getDb, closeDb } from "../src/database/db";
import { getDbIdentity, getMigrationStatus } from "../src/database/migrationStatus";

async function main(): Promise<void> {
  const db = getDb();
  const id = await getDbIdentity(db);
  const st = await getMigrationStatus(db);
  console.log("NODE_ENV            :", process.env.NODE_ENV);
  console.log("configured host:port :", `${id.configuredHost}:${id.configuredPort}`);
  console.log("database / user      :", `${id.database} / ${id.user}`);
  console.log("server hostname      :", id.serverHostname);
  console.log("server version       :", id.serverVersion);
  console.log("looks like AWS RDS   :", id.looksLikeRds ? "YES  <-- this is NOT a local database" : "no (local MySQL)");
  console.log("migrations applied   :", st.applied.length, "| latest:", st.applied[st.applied.length - 1] ?? "none");
  console.log("migrations pending   :", st.pending.length ? st.pending.join(", ") : "none");
  for (const t of ["shop_categories", "shop_products", "shop_product_cities", "shop_city_pricing", "shop_orders"]) {
    console.log(`table ${t.padEnd(20)}:`, (await db.schema.hasTable(t)) ? "exists" : "MISSING");
  }
  if (id.looksLikeRds) console.log("\nWARNING: connected to RDS. Do NOT run migrations from this machine without explicit approval.");
}

main()
  .catch((e) => {
    console.error("db:check failed:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => void closeDb());

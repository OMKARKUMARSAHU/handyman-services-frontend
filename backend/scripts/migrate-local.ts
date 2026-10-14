/**
 * SAFE local migration:  npm run migrate:local
 * Applies pending migrations ONLY when the connected server is a local development MySQL.
 * Refuses (and changes nothing) if NODE_ENV is not development, or if the server looks like AWS RDS
 * (e.g. 127.0.0.1 is really an SSH/SSM tunnel to production). Additive migrations only; no data is
 * dropped, truncated or reset by this script.
 */
import { getDb, closeDb } from "../src/database/db";
import { getDbIdentity, getMigrationStatus } from "../src/database/migrationStatus";

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") throw new Error(`Refusing: NODE_ENV is "${process.env.NODE_ENV}", expected "development".`);
  const db = getDb();
  const id = await getDbIdentity(db);
  console.log(`Connected to database "${id.database}" at ${id.configuredHost}:${id.configuredPort} (server ${id.serverHostname}, MySQL ${id.serverVersion}).`);
  if (id.looksLikeRds) throw new Error("Refusing: this server looks like AWS RDS (production). Nothing was changed.");
  if (!["127.0.0.1", "localhost", "::1"].includes(id.configuredHost)) throw new Error(`Refusing: host "${id.configuredHost}" is not local. Nothing was changed.`);
  const before = await getMigrationStatus(db);
  if (before.pending.length === 0) return void console.log("Nothing to do: no pending migrations.");
  console.log("Pending migrations to apply:\n  " + before.pending.join("\n  "));
  const [batch, applied] = (await db.migrate.latest({ directory: `${__dirname}/../src/database/migrations`, extension: "ts" })) as [number, string[]];
  console.log(`Applied batch ${batch}:\n  ` + applied.join("\n  "));
  const after = await getMigrationStatus(db);
  console.log("Pending now:", after.pending.length ? after.pending.join(", ") : "none");
}

main()
  .catch((e) => {
    console.error("migrate:local stopped:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => void closeDb());

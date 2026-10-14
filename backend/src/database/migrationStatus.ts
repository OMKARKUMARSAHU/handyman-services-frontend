import fs from "fs";
import path from "path";
import type { Knex } from "knex";

export interface MigrationStatus {
  applied: string[];
  pending: string[];
}

/**
 * Read-only: compares the migration files shipped with this code against the
 * `knex_migrations` table of the CONNECTED database. Never runs a migration.
 */
export async function getMigrationStatus(db: Knex): Promise<MigrationStatus> {
  const dir = path.resolve(__dirname, "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith(".d.ts"))
    .map((f) => f.replace(/\.(ts|js)$/, ""))
    .sort();
  let appliedRaw: string[] = [];
  if (await db.schema.hasTable("knex_migrations")) {
    appliedRaw = (await db("knex_migrations").select("name")).map((r: { name: string }) => r.name.replace(/\.(ts|js)$/, ""));
  }
  const appliedSet = new Set(appliedRaw);
  return { applied: files.filter((f) => appliedSet.has(f)), pending: files.filter((f) => !appliedSet.has(f)) };
}

export interface DbIdentity {
  configuredHost: string;
  configuredPort: number;
  database: string;
  user: string;
  serverHostname: string | null;
  serverVersion: string | null;
  looksLikeRds: boolean;
}

/**
 * Read-only: who are we REALLY connected to? A tunnel to RDS also shows up as
 * 127.0.0.1, so the configured host alone proves nothing — the server's own
 * basedir / hostname / version do (Amazon RDS MySQL lives under /rdsdbbin/).
 */
export async function getDbIdentity(db: Knex): Promise<DbIdentity> {
  const conn = (db.client as { config: { connection: { host?: string; port?: number; database?: string; user?: string } } }).config.connection;
  const [rows] = (await db.raw("SELECT @@hostname AS h, @@version AS v, @@basedir AS b, DATABASE() AS d, CURRENT_USER() AS u")) as [Array<{ h: string; v: string; b: string; d: string; u: string }>];
  const r = rows[0];
  const rdsish = /rdsdbbin|rds/i.test(r?.b ?? "") || /rds|amazonaws/i.test(r?.h ?? "") || /rds/i.test(r?.v ?? "") || /rds\.amazonaws/i.test(conn.host ?? "");
  return {
    configuredHost: String(conn.host ?? ""),
    configuredPort: Number(conn.port ?? 3306),
    database: r?.d ?? String(conn.database ?? ""),
    user: String(r?.u ?? conn.user ?? "").replace(/@.*/, "@…"),
    serverHostname: r?.h ?? null,
    serverVersion: r?.v ?? null,
    looksLikeRds: rdsish,
  };
}

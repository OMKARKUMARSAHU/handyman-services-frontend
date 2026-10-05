import type { Knex } from "knex";
import dotenv from "dotenv";
import path from "path";

// Preserve an explicitly-set NODE_ENV (e.g. `NODE_ENV=test jest ...`) so .env's own
// NODE_ENV=development can never silently switch a test run back to dev — while still
// letting dotenv override stale values for everything else (a long-lived shell/session
// can already hold an old, empty DB_PASSWORD from before .env was last edited, which
// plain dotenv/config would otherwise never refresh). This file loads before
// src/config/env.ts in the import graph (see src/database/db.ts), so the safeguard has
// to live here too, not only there.
const explicitNodeEnv = process.env.NODE_ENV;
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  override: true,
});
if (explicitNodeEnv) process.env.NODE_ENV = explicitNodeEnv;

/**
 * Knex configuration — one profile per environment, per
 * PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §24 (dev/staging/production never
 * share a database). `development` and `test` point at the local,
 * disposable MySQL instance used to validate migrations in this phase
 * (PHASE_1/PHASE_3 "validate migrations locally" instruction) — neither
 * profile has ever been pointed at the real `database-1` RDS instance.
 */

const base: Knex.Config = {
  client: "mysql2",
  migrations: {
    directory: "./migrations",
    tableName: "knex_migrations",
    extension: "ts",
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...base,
    connection: {
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "handyman_app",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "handyman_dev",
      charset: "utf8mb4",
    },
    pool: { min: 1, max: Number(process.env.DB_CONNECTION_LIMIT ?? 10) },
  },
  test: {
    ...base,
    connection: {
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "handyman_app",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_TEST_NAME ?? "handyman_test",
      charset: "utf8mb4",
    },
    pool: { min: 1, max: 5 },
  },
  production: {
    ...base,
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: "utf8mb4",
      ssl: { rejectUnauthorized: true },
    },
    pool: { min: 2, max: Number(process.env.DB_CONNECTION_LIMIT ?? 10) },
  },
};

export default config;

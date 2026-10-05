import knexFactory, { type Knex } from "knex";
import knexConfig from "./knexfile";
import { env } from "../config/env";

let instance: Knex | null = null;

/**
 * Singleton Knex instance for the running process. The backend is the
 * ONLY application layer that ever holds this handle (PHASE_1/PHASE_2 hard
 * rule — the frontend never connects to MySQL directly).
 */
export function getDb(): Knex {
  if (!instance) {
    const profile = knexConfig[env.NODE_ENV];
    if (!profile) {
      throw new Error(`No knex configuration found for NODE_ENV="${env.NODE_ENV}"`);
    }
    instance = knexFactory(profile);
  }
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}

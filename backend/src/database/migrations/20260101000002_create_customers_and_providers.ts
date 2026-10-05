import type { Knex } from "knex";

/**
 * customers, service_providers — PHASE_2_BACKEND_DATABASE_SCHEMA.md §7.
 * New tables (the mock frontend never needed real auth-backed identity
 * rows). `cognito_sub` is the Cognito JWT `sub` claim — the canonical
 * identity key every authenticated request is matched against.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("customers", (t) => {
    t.uuid("id").primary();
    t.string("cognito_sub", 100).notNullable().unique();
    t.string("name", 150).notNullable();
    t.string("phone", 20).nullable();
    t.string("email", 255).nullable().unique();
    t.enu("account_status", ["active", "disabled"]).notNullable().defaultTo("active");
    t.timestamps(true, true);
  });

  await knex.schema.createTable("service_providers", (t) => {
    t.uuid("id").primary();
    t.string("cognito_sub", 100).notNullable().unique();
    t.string("name", 150).notNullable();
    t.string("phone", 20).nullable();
    t.enu("account_status", ["active", "disabled"]).notNullable().defaultTo("active");
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("service_providers");
  await knex.schema.dropTableIfExists("customers");
}

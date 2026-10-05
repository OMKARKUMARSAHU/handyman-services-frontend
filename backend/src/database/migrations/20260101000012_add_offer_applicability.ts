import type { Knex } from "knex";

/**
 * PHASE 3 CORRECTION — Offer applicability model.
 *
 * Final business rule (supersedes the Phase 3 implementation's "cityId is
 * accepted but not a real filter" limitation): an Offer is either
 * ALL_INDIA (applies nationwide, `city_id` NULL) or CITY (applies to
 * exactly one city, `city_id` required). The two are mutually exclusive
 * and enforced by a CHECK constraint — an invalid combination can never be
 * persisted, by the database itself, not just application code.
 *
 * This is purely additive and non-destructive: the prior schema had NO
 * city column on `offers` at all, so no existing offer row was ever
 * actually city-scoped. Defaulting every row (existing or new) to
 * `applicability_type = 'all_india'` with `city_id = NULL` is therefore
 * the only reading consistent with the data that could possibly already
 * exist — not a reinterpretation, a continuation of what was already true.
 * No row is modified destructively and no data is lost.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("offers", (t) => {
    t.enu("applicability_type", ["all_india", "city"]).notNullable().defaultTo("all_india");
    t.uuid("city_id").nullable().references("id").inTable("cities").onDelete("RESTRICT");
    t.index(["applicability_type", "city_id"], "idx_offers_applicability_city");
  });

  // Strictly-increasing, auto-increment tie-breaker for deterministic
  // "most recently created wins" resolution when more than one Offer
  // matches the same tier (see offers.service.ts's pickEffectiveOffer).
  // `created_at` alone is a TIMESTAMP (second precision) and two offers
  // created in the same request/test can tie; `seq` never can. Added via
  // raw SQL (not knex's `increments()`) because MySQL requires an
  // AUTO_INCREMENT column to be a key in its own right — `increments()`
  // with `primaryKey: false` does not add one, which `ALTER TABLE` then
  // rejects.
  await knex.schema.raw("ALTER TABLE offers ADD COLUMN seq INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE");

  await knex.schema.raw(
    "ALTER TABLE offers ADD CONSTRAINT chk_offers_applicability_city CHECK (" +
      "(applicability_type = 'all_india' AND city_id IS NULL) OR " +
      "(applicability_type = 'city' AND city_id IS NOT NULL)" +
      ")"
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw("ALTER TABLE offers DROP CONSTRAINT chk_offers_applicability_city");
  await knex.schema.raw("ALTER TABLE offers DROP COLUMN seq");
  await knex.schema.alterTable("offers", (t) => {
    t.dropForeign(["city_id"]);
    t.dropIndex(["applicability_type", "city_id"], "idx_offers_applicability_city");
    t.dropColumn("city_id");
    t.dropColumn("applicability_type");
  });
}

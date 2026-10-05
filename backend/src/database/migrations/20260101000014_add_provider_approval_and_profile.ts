import type { Knex } from "knex";

/**
 * FINAL AUTHENTICATION ARCHITECTURE — provider approval pipeline.
 *
 * `service_providers.account_status` (active/disabled) already existed and
 * stays exactly what it was: an admin's enable/disable switch, orthogonal to
 * approval. This migration adds the actual approval gate the spec requires
 * ("Authorization must consider BOTH Cognito role AND provider approval
 * status") plus the marketplace-onboarding profile fields collected at
 * Service Provider signup (`/staff/provider/signup`).
 *
 * `approval_status` defaults to `pending_approval` for EVERY new row,
 * including the pre-existing lazy-creation path in
 * `findOrCreateServiceProviderBySub` (an operator manually creating a
 * provider in the Cognito Console still must not bypass approval).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("service_providers", (t) => {
    t.enu("approval_status", ["pending_approval", "approved", "rejected"]).notNullable().defaultTo("pending_approval");
    t.string("email", 255).nullable();
    t.string("business_name", 150).nullable();
    t.string("city", 100).nullable();
    t.json("categories").nullable();
    t.integer("years_experience").unsigned().nullable();
    t.text("bio").nullable();
    t.string("availability", 150).nullable();
    t.timestamp("terms_accepted_at").nullable();
    t.timestamp("privacy_accepted_at").nullable();
    t.timestamp("approved_at").nullable();
    t.string("reviewed_by_sub", 100).nullable();
    t.text("rejection_reason").nullable();
  });

  // Any pre-existing row (created before this migration, back when there was
  // no approval concept at all) is treated as already trusted rather than
  // retroactively locked out — only NEW rows from this point on go through
  // the approval gate. Safe because this project has no production data yet.
  await knex("service_providers").update({ approval_status: "approved" });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("service_providers", (t) => {
    t.dropColumn("approval_status");
    t.dropColumn("email");
    t.dropColumn("business_name");
    t.dropColumn("city");
    t.dropColumn("categories");
    t.dropColumn("years_experience");
    t.dropColumn("bio");
    t.dropColumn("availability");
    t.dropColumn("terms_accepted_at");
    t.dropColumn("privacy_accepted_at");
    t.dropColumn("approved_at");
    t.dropColumn("reviewed_by_sub");
    t.dropColumn("rejection_reason");
  });
}

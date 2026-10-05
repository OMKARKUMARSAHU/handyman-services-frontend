import type { Knex } from "knex";

/**
 * RAZORPAY INTEGRATION (TEST MODE): adds exactly one nullable column to the
 * existing, deliberately gateway-agnostic `payments` table
 * (20260101000009_create_payments.ts — "no gateway-specific column... on
 * purpose, that would mean guessing a provider Phase 3 was never told to
 * pick"). That TBD is now resolved by explicit client instruction: Razorpay,
 * test mode. Kept generically named (not `razorpay_payment_id`) to preserve
 * the table's existing gateway-agnostic design intent:
 *
 *  - `provider_reference` (already existed): the gateway's ORDER-level
 *    reference for this attempt — set at creation time to the Razorpay
 *    Order id (`order_xxx`).
 *  - `gateway_payment_reference` (new): the gateway's PAYMENT-level
 *    reference — set only once a payment signature has been verified
 *    server-side (Razorpay Payment id, `pay_xxx`). Left null for any
 *    attempt that was never completed (abandoned, cancelled, failed).
 *
 * No existing column, row, or constraint is touched — purely additive.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (t) => {
    t.string("gateway_payment_reference", 255).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (t) => {
    t.dropColumn("gateway_payment_reference");
  });
}

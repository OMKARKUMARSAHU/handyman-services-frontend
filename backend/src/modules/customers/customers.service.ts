import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { ForbiddenError, NotFoundError } from "../../shared/errors";
import { toCustomerDto, type CustomerDto, type CustomerRow } from "./customers.types";

const TABLE = "customers";

/**
 * Cognito is the identity/auth system of record; this table only mirrors
 * what the backend needs locally (PHASE_2_BACKEND_DATABASE_SCHEMA.md §7).
 * The first authenticated request from a given customer's token
 * just-in-time creates their local row — there is no separate
 * "provision the customer row" step in the sign-up flow to keep in sync.
 */
export async function findOrCreateCustomerBySub(
  sub: string,
  claims: Record<string, unknown>
): Promise<CustomerDto> {
  const existing = await getDb()<CustomerRow>(TABLE).where({ cognito_sub: sub }).first();
  if (existing) {
    if (existing.account_status === "disabled") {
      throw new ForbiddenError("This customer account has been disabled.");
    }
    return toCustomerDto(existing);
  }
  const id = randomUUID();
  const name = typeof claims.name === "string" ? claims.name : "Customer";
  const phone = typeof claims.phone_number === "string" ? claims.phone_number : null;
  const email = typeof claims.email === "string" ? claims.email : null;
  await getDb()<CustomerRow>(TABLE).insert({ id, cognito_sub: sub, name, phone, email, account_status: "active" });
  return { id, cognitoSub: sub, name, phone, email, accountStatus: "active" };
}

export async function getCustomerBySub(sub: string): Promise<CustomerDto | null> {
  const row = await getDb()<CustomerRow>(TABLE).where({ cognito_sub: sub }).first();
  return row ? toCustomerDto(row) : null;
}

export async function getCustomerById(id: string): Promise<CustomerDto | null> {
  const row = await getDb()<CustomerRow>(TABLE).where({ id }).first();
  return row ? toCustomerDto(row) : null;
}

/**
 * Resolves the Cognito `sub` that owns a `customers.id` row — used by
 * `requireOwnership()` on routes keyed by an internal customer id rather
 * than "/me" (e.g. an order lookup that stores `orders.customer_id`).
 */
export async function getCustomerOwnerSubById(customerId: string): Promise<string | null> {
  const row = await getDb()<CustomerRow>(TABLE).where({ id: customerId }).first();
  return row ? row.cognito_sub : null;
}

export async function updateOwnCustomerProfile(
  sub: string,
  patch: { name?: string; phone?: string | null }
): Promise<CustomerDto> {
  const existing = await getDb()<CustomerRow>(TABLE).where({ cognito_sub: sub }).first();
  if (!existing) throw new NotFoundError("Customer profile not found.");
  const dbPatch: Partial<CustomerRow> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (Object.keys(dbPatch).length > 0) {
    await getDb()<CustomerRow>(TABLE).where({ cognito_sub: sub }).update(dbPatch);
  }
  const updated = await getCustomerBySub(sub);
  if (!updated) throw new Error("Failed to read back updated customer profile.");
  return updated;
}

/** Admin-only: list/search + enable/disable, mirroring the provider equivalent. */
export async function listCustomers(
  search: string | undefined,
  pagination: { page: number; pageSize: number }
): Promise<{ items: CustomerDto[]; total: number }> {
  let query = getDb()<CustomerRow>(TABLE);
  if (search) {
    query = query.andWhere((b) => b.whereILike("name", `%${search}%`).orWhereILike("email", `%${search}%`));
  }
  const countRow = await query.clone().count<{ count: string }[]>("id as count").first();
  const total = Number(countRow?.count ?? 0);
  const rows = await query
    .clone()
    .orderBy("created_at", "desc")
    .offset((pagination.page - 1) * pagination.pageSize)
    .limit(pagination.pageSize);
  return { items: rows.map(toCustomerDto), total };
}

export async function setCustomerAccountStatus(id: string, accountStatus: "active" | "disabled"): Promise<CustomerDto> {
  const existing = await getDb()<CustomerRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Customer not found.");
  await getDb()<CustomerRow>(TABLE).where({ id }).update({ account_status: accountStatus });
  // NOTE: PHASE_2_AUTHORIZATION_MATRIX.md §4 requires this to also disable the Cognito user —
  // that Cognito admin-api call is not wired up in this phase (no real Cognito credentials
  // are available to this environment); see PHASE_3_BACKEND_IMPLEMENTATION.md limitations.
  const updated = await getDb()<CustomerRow>(TABLE).where({ id }).first();
  return toCustomerDto(updated!);
}

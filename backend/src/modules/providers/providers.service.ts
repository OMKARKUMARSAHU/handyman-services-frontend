import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { ForbiddenError, NotFoundError } from "../../shared/errors";
import { toServiceProviderDto, type ProviderApprovalStatus, type ServiceProviderDto, type ServiceProviderRow } from "./providers.types";

const TABLE = "service_providers";

/**
 * Cognito is the identity/auth system of record; this table only mirrors
 * what the backend needs locally (PHASE_2_BACKEND_DATABASE_SCHEMA.md §7).
 * The first authenticated request from a given provider's token
 * just-in-time creates their local row IF one doesn't already exist — a
 * self-registered provider (see `createProviderApplication` below) already
 * has one, created eagerly at signup with their real onboarding profile, so
 * this branch only ever fires for a provider account created directly in
 * the Cognito Console/AdminCreateUser without going through
 * `/staff/provider/signup`.
 *
 * FINAL AUTHENTICATION ARCHITECTURE: a newly-created row here still starts
 * `pending_approval` — being in the `provider` Cognito group is never, on
 * its own, enough to bypass the approval gate ("Do not bypass approval just
 * because the user belongs to the provider Cognito group").
 */
export async function findOrCreateServiceProviderBySub(
  sub: string,
  claims: Record<string, unknown>
): Promise<ServiceProviderDto> {
  const existing = await getDb()<ServiceProviderRow>(TABLE).where({ cognito_sub: sub }).first();
  if (existing) {
    if (existing.account_status === "disabled") {
      throw new ForbiddenError("This provider account has been disabled.");
    }
    return toServiceProviderDto(existing);
  }
  const id = randomUUID();
  const name = typeof claims.name === "string" ? claims.name : "Service Provider";
  const phone = typeof claims.phone_number === "string" ? claims.phone_number : null;
  const email = typeof claims.email === "string" ? claims.email : null;
  await getDb()<ServiceProviderRow>(TABLE).insert({
    id,
    cognito_sub: sub,
    name,
    email,
    phone,
    account_status: "active",
    approval_status: "pending_approval",
  });
  const row = await getDb()<ServiceProviderRow>(TABLE).where({ id }).first();
  return toServiceProviderDto(row!);
}

export async function getServiceProviderBySub(sub: string): Promise<ServiceProviderDto | null> {
  const row = await getDb()<ServiceProviderRow>(TABLE).where({ cognito_sub: sub }).first();
  return row ? toServiceProviderDto(row) : null;
}

/**
 * Creates the local provider row EAGERLY, at self-service signup time (see
 * `POST /auth/provider/signup`), using `cognitoSub` from that SignUp call's
 * own `UserSub` response field. This is the one place in the whole backend
 * that collects the marketplace-onboarding profile (business name, city,
 * categories, experience, bio, availability, terms/privacy acceptance) —
 * none of that fits in a Cognito JWT claim, so it has to be captured here,
 * not reconstructed later from the token. Always starts `pending_approval`.
 */
export async function createProviderApplication(input: {
  cognitoSub: string;
  name: string;
  email: string;
  phone: string;
  businessName?: string;
  city: string;
  categories: string[];
  yearsExperience?: number;
  bio?: string;
  availability?: string;
}): Promise<ServiceProviderDto> {
  const id = randomUUID();
  const now = new Date();
  await getDb()<ServiceProviderRow>(TABLE).insert({
    id,
    cognito_sub: input.cognitoSub,
    name: input.name,
    email: input.email,
    phone: input.phone,
    business_name: input.businessName ?? null,
    city: input.city,
    categories: JSON.stringify(input.categories ?? []),
    years_experience: input.yearsExperience ?? null,
    bio: input.bio ?? null,
    availability: input.availability ?? null,
    account_status: "active",
    approval_status: "pending_approval",
    terms_accepted_at: now,
    privacy_accepted_at: now,
  });
  const row = await getDb()<ServiceProviderRow>(TABLE).where({ id }).first();
  return toServiceProviderDto(row!);
}

export async function updateOwnProviderProfile(
  sub: string,
  patch: { name?: string; phone?: string | null }
): Promise<ServiceProviderDto> {
  const existing = await getDb()<ServiceProviderRow>(TABLE).where({ cognito_sub: sub }).first();
  if (!existing) throw new NotFoundError("Provider profile not found.");
  const dbPatch: Partial<ServiceProviderRow> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (Object.keys(dbPatch).length > 0) {
    await getDb()<ServiceProviderRow>(TABLE).where({ cognito_sub: sub }).update(dbPatch);
  }
  const updated = await getServiceProviderBySub(sub);
  if (!updated) throw new Error("Failed to read back updated provider profile.");
  return updated;
}

/** Admin-only: list/search/filter-by-approval + enable/disable, mirroring the customer equivalent. */
export async function listServiceProviders(
  search: string | undefined,
  approvalStatus: ProviderApprovalStatus | undefined,
  pagination: { page: number; pageSize: number }
): Promise<{ items: ServiceProviderDto[]; total: number }> {
  let query = getDb()<ServiceProviderRow>(TABLE);
  if (search) query = query.andWhere((b) => b.whereILike("name", `%${search}%`));
  if (approvalStatus) query = query.andWhere({ approval_status: approvalStatus });
  const countRow = await query.clone().count<{ count: string }[]>("id as count").first();
  const total = Number(countRow?.count ?? 0);
  const rows = await query
    .clone()
    .orderBy("created_at", "desc")
    .offset((pagination.page - 1) * pagination.pageSize)
    .limit(pagination.pageSize);
  return { items: rows.map(toServiceProviderDto), total };
}

export async function setProviderAccountStatus(id: string, accountStatus: "active" | "disabled"): Promise<ServiceProviderDto> {
  const existing = await getDb()<ServiceProviderRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Provider not found.");
  await getDb()<ServiceProviderRow>(TABLE).where({ id }).update({ account_status: accountStatus });
  // NOTE: PHASE_2_AUTHORIZATION_MATRIX.md §4 requires this to also disable the Cognito user —
  // that Cognito admin-api call is not wired up in this phase (no real Cognito credentials
  // are available to this environment); see PHASE_3_BACKEND_IMPLEMENTATION.md limitations.
  const updated = await getDb()<ServiceProviderRow>(TABLE).where({ id }).first();
  return toServiceProviderDto(updated!);
}

/** Admin is the ONLY role allowed to call these (enforced by `requireRole("admin")` on the route, not here). */
export async function approveProvider(id: string, adminSub: string): Promise<ServiceProviderDto> {
  const existing = await getDb()<ServiceProviderRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Provider not found.");
  await getDb()<ServiceProviderRow>(TABLE).where({ id }).update({
    approval_status: "approved",
    approved_at: new Date(),
    reviewed_by_sub: adminSub,
    rejection_reason: null,
  });
  const updated = await getDb()<ServiceProviderRow>(TABLE).where({ id }).first();
  return toServiceProviderDto(updated!);
}

export async function rejectProvider(id: string, adminSub: string, reason: string | undefined): Promise<ServiceProviderDto> {
  const existing = await getDb()<ServiceProviderRow>(TABLE).where({ id }).first();
  if (!existing) throw new NotFoundError("Provider not found.");
  await getDb()<ServiceProviderRow>(TABLE).where({ id }).update({
    approval_status: "rejected",
    approved_at: null,
    reviewed_by_sub: adminSub,
    rejection_reason: reason ?? null,
  });
  const updated = await getDb()<ServiceProviderRow>(TABLE).where({ id }).first();
  return toServiceProviderDto(updated!);
}

/**
 * The actual enforcement of "a provider's dashboard/listing actions require
 * BOTH the Cognito `provider` group AND an `approved` local status" — call
 * this (after `findOrCreateServiceProviderBySub`) from every provider
 * ACTION route (listings create/update/etc). Deliberately NOT called from
 * `GET /provider/me` / `GET /me` — those must keep working while pending or
 * rejected so the frontend can render the correct status screen.
 */
export function assertProviderApproved(profile: ServiceProviderDto): void {
  if (profile.approvalStatus === "approved") return;
  throw new ForbiddenError(
    profile.approvalStatus === "rejected"
      ? "Your Service Provider application was not approved. You do not have access to the Service Provider dashboard."
      : "Your Service Provider account is awaiting admin approval. You do not have access to the Service Provider dashboard yet."
  );
}

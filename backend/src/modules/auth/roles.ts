/**
 * Exactly three application roles (Phase 3 brief §2 — "do NOT create a
 * fourth 'Super Admin' role"). Matches the Cognito Group names configured
 * in PHASE_2_AUTHORIZATION_MATRIX.md §4.
 */
export const ROLES = ["customer", "admin", "provider"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

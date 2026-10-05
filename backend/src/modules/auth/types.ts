import type { Role } from "./roles";

/** Populated on `req.auth` by the `authenticate` middleware after successful JWT verification. */
export interface AuthenticatedUser {
  /** Cognito's stable identifier — the JWT `sub` claim. Canonical identity key (PHASE_2_BACKEND_DATABASE_SCHEMA.md §7). */
  sub: string;
  role: Role;
  /** Raw decoded token payload, kept for anything not promoted to a named field above. */
  claims: Record<string, unknown>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
      /** Per-request correlation ID (middleware/requestId.ts) — included in every log line and error response. */
      requestId?: string;
    }
  }
}

export {};

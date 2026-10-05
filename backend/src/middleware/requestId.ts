import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

/**
 * Attaches a per-request correlation ID, echoed in every error response
 * (PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §18) and every log line (§21) so
 * a user-reported issue can be traced server-side without exposing
 * internals.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}

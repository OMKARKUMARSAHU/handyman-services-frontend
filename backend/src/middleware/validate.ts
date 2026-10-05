import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/**
 * Schema-based input validation at the API boundary
 * (PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §19) — rejects malformed/
 * unexpected input before any handler/business logic runs. A failure here
 * is caught by errorHandler's ZodError branch, so every module gets the
 * same 400 VALIDATION_ERROR shape for free.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query);
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.params = schema.parse(req.params);
    next();
  };
}

import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors";
import { logger } from "../shared/logger";

/**
 * The ONLY place a response body is produced for an error — every thrown
 * AppError (or unexpected error) funnels through here, guaranteeing the
 * one consistent envelope (PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §18) and
 * guaranteeing no raw DB error / stack trace / secret ever reaches a
 * client response, in any environment.
 */
export function errorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.requestId;

    if (err instanceof ZodError) {
      logger.warn({ requestId, issues: err.issues }, "validation_error");
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The request failed validation.",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        requestId,
      });
      return;
    }

    if (err instanceof AppError) {
      const level = err.status >= 500 ? "error" : "warn";
      logger[level]({ requestId, code: err.code, status: err.status, err }, "app_error");
      res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
        requestId,
      });
      return;
    }

    // Unexpected error: log full detail server-side, return a generic body.
    logger.error({ requestId, err }, "unhandled_error");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred. Please try again." },
      requestId,
    });
  };
}

export function notFoundHandler() {
  return (req: Request, res: Response): void => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: `No route matches ${req.method} ${req.path}.` },
      requestId: req.requestId,
    });
  };
}

/**
 * Error taxonomy matching PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §18.
 *
 * Every thrown AppError carries an HTTP status and a stable `code` string.
 * The central error handler (middleware/errorHandler.ts) is the ONLY place
 * that turns these into a response body — nothing here writes to `res`
 * directly, keeping the error envelope consistent everywhere.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request failed validation.", details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication is required for this request.") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "The request conflicts with the current state of the resource.", details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

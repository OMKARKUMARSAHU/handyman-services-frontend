import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/**
 * Per PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §19: rate limiting is
 * recommended, thresholds are a tuning detail, not over-engineered here.
 * Applied globally at the app level; a stricter, endpoint-specific limiter
 * can be layered on later for specific write endpoints if real traffic
 * shows a need — not anticipated here.
 */
export function defaultRateLimiter() {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down and try again shortly." },
    },
  });
}

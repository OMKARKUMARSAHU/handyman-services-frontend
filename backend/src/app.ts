import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env, corsAllowedOrigins } from "./config/env";
import { requestId } from "./middleware/requestId";
import { defaultRateLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { buildRouter } from "./routes";

/**
 * App assembly — PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §1/§19.
 * Kept separate from server.ts (which binds a port) so tests can import
 * the Express app directly and drive it with supertest, with no network
 * socket involved.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin/non-browser requests (no Origin header, e.g. server-to-server) are allowed;
        // otherwise the origin must be on the explicit allow-list — never a wildcard (§19).
        if (!origin || corsAllowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin not allowed by CORS: ${origin}`));
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(defaultRateLimiter());

  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, data: { status: "ok" } });
  });

  app.use(env.API_BASE_PATH, buildRouter());

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}

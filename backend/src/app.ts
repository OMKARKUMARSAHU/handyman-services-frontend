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

  // Elastic Beanstalk always puts at least one reverse proxy in front of
  // this process (the instance's own nginx in a single-instance
  // environment, or that nginx behind an ALB too in a load-balanced one)
  // -- without this, Express's req.ip collapses to the nearest proxy's
  // address for every request, which would bucket every client under the
  // same key in defaultRateLimiter() below. `true` trusts the whole
  // X-Forwarded-For chain rather than a hard-coded hop count, since both
  // possible EB topologies are AWS-controlled infrastructure (never a
  // client-spoofable hop), so it stays correct whichever one this
  // environment turns out to be.
  app.set("trust proxy", true);

  app.disable("x-powered-by");
  // PRODUCTION INCIDENT FOLLOW-UP ("ERR_CONNECTION_TIMED_OUT" on the EB
  // backend URL in every browser, while curl/Test-NetConnection succeed on
  // the exact same host:80): helmet's own `hsts` middleware sets
  // `Strict-Transport-Security` UNCONDITIONALLY on every response --
  // including over this environment's plain-HTTP-only listener (security
  // group only has port 80 open; nothing listens on 443 yet). The first
  // time any browser received that header from this host over HTTP, it
  // cached an HSTS policy telling itself to silently upgrade every future
  // request to this exact host to https:// *before even opening a
  // connection* -- and since nothing answers on 443, that upgraded request
  // just hangs until the browser times out. Non-browser tools (curl,
  // Test-NetConnection) have no such cache, which is exactly why they
  // "worked" while every browser did not.
  //
  // Fix: disable helmet's unconditional hsts and only ever send the header
  // when this exact request actually arrived over HTTPS end-to-end
  // (`req.secure`, accurate now that `trust proxy` above makes Express
  // honor the `X-Forwarded-Proto` header EB's nginx already sets). Once a
  // real HTTPS listener/ACM cert is added in front of this environment,
  // X-Forwarded-Proto will say "https" and this starts sending HSTS again
  // automatically -- nothing else to change then.
  app.use(helmet({ hsts: false }));
  app.use((req, res, next) => {
    if (req.secure) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
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

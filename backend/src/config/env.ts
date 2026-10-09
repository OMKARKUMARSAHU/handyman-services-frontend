import dotenv from "dotenv";
// Preserve an explicitly-set NODE_ENV (e.g. `NODE_ENV=test jest ...`) so .env's own
// NODE_ENV=development can never silently switch a test run back to dev — while still
// letting dotenv override stale values for everything else (see knexfile.ts's comment
// for why `override: true` is needed here at all: a long-lived shell can already hold an
// old, empty DB_PASSWORD from before .env was last edited, which plain dotenv/config
// would otherwise never refresh).
const explicitNodeEnv = process.env.NODE_ENV;
dotenv.config({ override: true });
if (explicitNodeEnv) process.env.NODE_ENV = explicitNodeEnv;
import { z } from "zod";

/**
 * Centralized, validated environment configuration.
 *
 * Every variable name here matches PHASE_2_AWS_ARCHITECTURE.md §20 /
 * .env.example exactly — nothing here invents a new variable name. A
 * missing *required* variable fails fast at boot (better than a silent
 * `undefined` reaching a query or an AWS SDK client later). Secrets are
 * never logged.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_PATH: z.string().default("/api/v1"),
  // MEDIA FIX FOLLOW-UP: this backend's own externally-reachable origin --
  // needed so buildPublicUrl() (media.service.ts) can hand out an absolute
  // URL to the new GET /media/file/<key> route (see that file's doc
  // comment for why). Defaults to the local dev backend address so this
  // works with zero .env changes locally; set to the real API origin
  // (e.g. https://api.handymanservices.in) before production.
  API_PUBLIC_BASE_URL: z.string().default("http://localhost:4000"),
  LOG_LEVEL: z.string().default("info"),
  /** How often (ms) the server-side scheduler publishes blog posts whose scheduled time has arrived. 0 disables the timer (read-time promotion still applies). */
  BLOG_SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(0).default(60_000),

  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),

  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default("handyman_dev"),
  DB_USER: z.string().default("handyman_app"),
  DB_PASSWORD: z.string().default(""),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  COGNITO_REGION: z.string().default("ap-south-1"),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CUSTOMER_APP_CLIENT_ID: z.string().optional(),
  COGNITO_ADMIN_PROVIDER_APP_CLIENT_ID: z.string().optional(),
  // The Admin/Provider app client is a confidential (backend-only, never
  // exposed to a browser) client created with a secret — every Cognito call
  // made with it must include a computed SECRET_HASH (see secretHash.ts).
  // The Customer app client has no secret (public client) — never set a
  // value here for it.
  COGNITO_ADMIN_PROVIDER_APP_CLIENT_SECRET: z.string().optional(),

  S3_BUCKET_NAME: z.string().optional(),
  S3_REGION: z.string().default("ap-south-1"),
  S3_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  S3_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  // VIDEO SHOWCASE ADMIN FIX: the shared 10MB cap above was sized for
  // images (PHASE_2_AWS_ARCHITECTURE.md §15) and is applied by
  // media.service.ts to the Catalog's own per-service image uploads,
  // left untouched here. It is far too small for real video clips (even
  // a short, low-res clip routinely exceeds it), which in practice made
  // "upload a video" in the Media Library fail every time it was tried
  // with a real file -- the direct cause this variable fixes. Used only
  // by the Central Media Library (media-library.service.ts) when the
  // upload's content type is a video; image uploads through that same
  // module keep using S3_MAX_UPLOAD_BYTES above, unchanged.
  S3_MAX_VIDEO_UPLOAD_BYTES: z.coerce.number().int().positive().default(200 * 1024 * 1024),
  // Local-dev-only fallback credentials (.env.example's own note: "never set these in
  // production configuration" — ECS Fargate's task IAM role supplies credentials there
  // via the SDK's default provider chain instead).
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // --- Payment gateway (Razorpay, TEST MODE) ---
  // Optional at the schema level (so the backend still boots with no gateway
  // configured, matching the existing "boot even without S3 configured"
  // pattern) -- payments.service.ts fails the specific request, not server
  // startup, if a payment is attempted with these unset. Never hardcode a
  // value here or anywhere else -- these must come only from the real .env
  // (untracked) at runtime, test-mode keys only.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration — see logged field errors above.");
  }
  return parsed.data;
}

export const env = loadEnv();

export const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

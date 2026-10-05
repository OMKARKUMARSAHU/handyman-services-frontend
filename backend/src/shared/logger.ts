import pino from "pino";
import { env } from "../config/env";

/**
 * Structured JSON logging (PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §21) —
 * intended to ship to CloudWatch Logs via whatever the ECS Fargate log
 * driver is configured to capture (stdout), not written here directly.
 * Deliberately plain JSON in every environment (no pretty-printer
 * dependency) since CloudWatch is the real destination and local
 * development is well served by reading raw JSON lines too.
 *
 * Hard rule: never log a secret (DB password, Cognito client secret, AWS
 * keys) or full PII (raw address/phone) — log identifiers (customer/order
 * ID), not the sensitive value itself.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
});

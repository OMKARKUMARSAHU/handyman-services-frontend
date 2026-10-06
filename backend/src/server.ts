import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./shared/logger";
import { getDb, closeDb } from "./database/db";

async function main(): Promise<void> {
  // Fail fast if the database is unreachable rather than starting and
  // failing on the first request.
  await getDb().raw("SELECT 1");

  const app = createApp();
  // Explicit host bind: Elastic Beanstalk's local nginx proxies to this
  // process over the loopback interface, but binding all interfaces
  // (rather than relying on Node's platform-dependent "no host given"
  // default) is what EB's own health checker and docs expect.
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT, basePath: env.API_BASE_PATH }, "backend_listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "backend_shutting_down");
    server.close(() => {
      closeDb().finally(() => process.exit(0));
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "backend_failed_to_start");
  process.exit(1);
});

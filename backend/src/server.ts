import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./shared/logger";
import { getDb, closeDb } from "./database/db";
import { getDbIdentity, getMigrationStatus } from "./database/migrationStatus";
import { startBlogScheduler, stopBlogScheduler } from "./modules/blog/blogScheduler";
import { startShopScheduler, stopShopScheduler } from "./modules/shop/shopScheduler";

async function main(): Promise<void> {
  // Fail fast if the database is unreachable rather than starting and
  // failing on the first request.
  await getDb().raw("SELECT 1");

  // Visibility only (never changes anything): which database is this process really using, and is its
  // schema behind this code? A pending migration is the usual cause of "500" on a newly added feature.
  try {
    const id = await getDbIdentity(getDb());
    logger.info({ database: id.database, configuredHost: id.configuredHost, port: id.configuredPort, looksLikeRds: id.looksLikeRds }, "database_connected");
    const status = await getMigrationStatus(getDb());
    if (status.pending.length > 0) {
      logger.warn(
        { pending: status.pending },
        "database_has_pending_migrations — features that need them will answer 503 DATABASE_NOT_MIGRATED. Run `npm run db:check`, then (local dev DB only) `npm run migrate:local`."
      );
    }
  } catch (err) {
    logger.warn({ err }, "database_status_check_failed");
  }

  const app = createApp();
  // Explicit host bind: Elastic Beanstalk's local nginx proxies to this
  // process over the loopback interface, but binding all interfaces
  // (rather than relying on Node's platform-dependent "no host given"
  // default) is what EB's own health checker and docs expect.
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT, basePath: env.API_BASE_PATH }, "backend_listening");
  });

  startBlogScheduler(env.BLOG_SCHEDULER_INTERVAL_MS);
  startShopScheduler(env.SHOP_SCHEDULER_INTERVAL_MS, env.SHOP_ORDER_EXPIRY_MINUTES);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "backend_shutting_down");
    stopBlogScheduler();
    stopShopScheduler();
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

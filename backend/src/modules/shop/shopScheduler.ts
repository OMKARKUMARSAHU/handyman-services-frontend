import { logger } from "../../shared/logger";
import { expireStalePendingShopOrders } from "./shopOrders.service";

/**
 * Releases stock held by unpaid shop orders. Same in-process-interval approach
 * as the Blog scheduler (single Node process on Elastic Beanstalk). Each tick is
 * idempotent (conditional UPDATE per order), so overlapping ticks or several
 * instances are harmless.
 */
let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick(maxAgeMinutes: number): Promise<void> {
  if (running) return;
  running = true;
  try {
    const expired = await expireStalePendingShopOrders(maxAgeMinutes);
    if (expired > 0) logger.info({ expired }, "shop_scheduler_expired_unpaid_orders");
  } catch (err) {
    logger.error({ err }, "shop_scheduler_tick_failed");
  } finally {
    running = false;
  }
}

export function startShopScheduler(intervalMs: number, maxAgeMinutes: number): void {
  if (timer || intervalMs <= 0) return;
  timer = setInterval(() => void tick(maxAgeMinutes), intervalMs);
  timer.unref();
  logger.info({ intervalMs, maxAgeMinutes }, "shop_scheduler_started");
}

export function stopShopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

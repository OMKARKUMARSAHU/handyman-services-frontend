import { logger } from "../../shared/logger";
import { promoteDueScheduledPosts } from "./blogPosts.service";

/**
 * Server-side scheduled-publishing timer. Deployment context: the backend
 * is a single long-running Node process on Elastic Beanstalk (see
 * `server.ts`), so an in-process interval is the appropriate, dependency-
 * free mechanism -- no cron daemon, queue, or extra AWS resource needed.
 *
 * Each tick runs `promoteDueScheduledPosts()`, a single idempotent UPDATE,
 * so running it on several instances at once (or alongside the read-time
 * safety net in `blogPosts.service.ts`) is harmless.
 */
let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return; // never overlap ticks if the DB is slow
  running = true;
  try {
    const promoted = await promoteDueScheduledPosts();
    if (promoted > 0) logger.info({ promoted }, "blog_scheduler_published_due_posts");
  } catch (err) {
    logger.error({ err }, "blog_scheduler_tick_failed");
  } finally {
    running = false;
  }
}

/** Starts the scheduler (no-op if already started or `intervalMs` <= 0). Runs one tick immediately so posts that came due while the process was down are published at boot. */
export function startBlogScheduler(intervalMs: number): void {
  if (timer || intervalMs <= 0) return;
  void tick();
  timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  logger.info({ intervalMs }, "blog_scheduler_started");
}

export function stopBlogScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

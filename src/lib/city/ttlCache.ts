/**
 * Tiny in-memory TTL cache for browser-side city results.
 *
 * Keys MUST include the city (and every query parameter that changes the answer) — see `cityResultKey`.
 * Purpose: switching Patna → Ranchi → Patna shows the right data instantly without re-hitting the API each
 * time (the backend rate-limits per IP), while the short TTL keeps availability/price edits made in Admin
 * visible within about half a minute. Failures are never stored.
 */
export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  clear(): void;
  size(): number;
}

export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now, maxEntries = 100): TtlCache<T> {
  const store = new Map<string, { value: T; expiresAt: number }>();
  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= now()) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      if (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expiresAt: now() + ttlMs });
    },
    clear() {
      store.clear();
    },
    size() {
      return store.size;
    },
  };
}

/** Cache key that can never mix two cities (or two different queries) together. */
export function cityResultKey(citySlug: string | null | undefined, scope: string): string {
  return `${citySlug ?? "__base__"}::${scope}`;
}

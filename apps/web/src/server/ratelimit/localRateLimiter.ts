import type { RateLimitResult } from "./limiter";

interface Entry {
  count: number;
  windowStart: number;
  windowSec: number;
}

/**
 * In-memory fixed-window rate limiter used as a safe fallback when Redis is
 * unavailable. Keys expire naturally when their window elapses; stale entries
 * are swept periodically and when the map exceeds a configured maximum.
 *
 * Thread-safety: Node.js event loop is single-threaded, so Map reads/writes
 * are atomic within a single process — no lock needed.
 */
export class LocalRateLimiter {
  private readonly store = new Map<string, Entry>();
  private readonly maxEntries: number;
  private opsSinceCleanup = 0;
  private static readonly CLEANUP_EVERY = 200;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Number of entries currently tracked (exposed for testing).
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Check whether `key` may proceed within `limit` requests per `windowSec`
   * seconds. Returns the same shape as the Redis-backed limiter.
   */
  check(key: string, limit: number, windowSec: number): RateLimitResult {
    this.maybeCleanup();

    const now = Date.now();
    const entry = this.store.get(key);
    const windowMs = windowSec * 1000;

    // New window or window expired — start fresh.
    if (!entry || now - entry.windowStart >= windowMs) {
      this.store.set(key, { count: 1, windowStart: now, windowSec });
      return { ok: true, remaining: limit - 1, limit, resetSec: windowSec };
    }

    entry.count++;

    // Prevent counter overflow (an attacker could wedge a key for 2^53 ops)
    if (entry.count > limit) {
      entry.count = limit + 1;
    }

    const remaining = Math.max(0, limit - entry.count);
    const elapsedMs = now - entry.windowStart;
    const resetSec = Math.max(1, Math.floor((windowMs - elapsedMs) / 1000));

    return {
      ok: entry.count <= limit,
      remaining,
      limit,
      resetSec,
    };
  }

  /**
   * Reset state (useful in tests). Not exposed on the public API consumed by
   * the routes — only called internally or directly in test files.
   */
  reset(): void {
    this.store.clear();
    this.opsSinceCleanup = 0;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private maybeCleanup(): void {
    this.opsSinceCleanup++;

    const shouldClean =
      this.opsSinceCleanup >= LocalRateLimiter.CLEANUP_EVERY ||
      this.store.size > this.maxEntries;

    if (!shouldClean) return;

    this.opsSinceCleanup = 0;
    this.sweepExpired();

    if (this.store.size > this.maxEntries) {
      this.evictOldest();
    }
  }

  /** Remove entries whose window has elapsed. */
  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now - entry.windowStart >= entry.windowSec * 1000) {
        this.store.delete(key);
      }
    }
  }

  /** Remove the oldest entries until map is no more than 75 % of max. */
  private evictOldest(): void {
    const target = Math.floor(this.maxEntries * 0.75);
    if (this.store.size <= target) return;
    const sorted = [...this.store.entries()].sort(
      (a, b) => a[1].windowStart - b[1].windowStart,
    );
    const toRemove = this.store.size - target;
    for (let i = 0; i < toRemove; i++) {
      this.store.delete(sorted[i][0]);
    }
  }
}

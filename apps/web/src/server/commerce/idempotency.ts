/**
 * Commerce Idempotency Manager (Milestone C18)
 *
 * Ensures mutating operations (Add to Cart, Update Cart, Remove from Cart)
 * are idempotent so network retries do not result in duplicate cart items.
 */

interface CacheEntry {
  result: any;
  timestamp: number;
}

export class IdempotencyManager {
  private static cache = new Map<string, CacheEntry>();
  private static TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Generates a deterministic idempotency key for an action if none provided.
   */
  static generateKey(sessionId: string, action: string, payload: Record<string, unknown>): string {
    const payloadStr = JSON.stringify(payload);
    let hash = 0;
    const str = `${sessionId}:${action}:${payloadStr}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `idempotency_${sessionId}_${Math.abs(hash)}`;
  }

  /**
   * Executes a mutating function with idempotency protection.
   */
  static async executeIdempotent<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.cleanExpired();

    const existing = this.cache.get(key);
    if (existing) {
      return existing.result as T;
    }

    const result = await operation();
    this.cache.set(key, { result, timestamp: Date.now() });
    return result;
  }

  private static cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }
}

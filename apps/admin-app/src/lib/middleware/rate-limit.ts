export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetSec: number;
}

class LocalRateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  check(key: string, limit: number, windowSec: number): RateLimitResult {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || existing.resetAt < now) {
      this.windows.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      return { ok: true, remaining: limit - 1, limit, resetSec: windowSec };
    }

    existing.count++;
    const remaining = Math.max(0, limit - existing.count);
    const resetSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

    if (existing.count > limit) {
      return { ok: false, remaining: 0, limit, resetSec };
    }

    return { ok: true, remaining, limit, resetSec };
  }

  reset(): void {
    this.windows.clear();
  }
}

const localLimiter = new LocalRateLimiter();

function redisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function redisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  if (!redisUrl() || !redisToken()) {
    return localLimiter.check(key, limit, windowSec);
  }

  try {
    const res = await fetch(`${redisUrl()}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSec, "NX"],
      ]),
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) {
      return localLimiter.check(key, limit, windowSec);
    }

    const data = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(data?.[0]?.result);
    if (!Number.isFinite(count)) {
      return localLimiter.check(key, limit, windowSec);
    }

    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      resetSec: windowSec,
    };
  } catch {
    return localLimiter.check(key, limit, windowSec);
  }
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

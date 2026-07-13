/**
 * Fixed-window rate limiter backed by Upstash Redis (REST) — raw fetch,
 * no SDK, matching the Groq/Voyage/Paystack pattern.
 *
 * The window is anchored from the first request in it: a single pipelined
 * `INCR` + `EXPIRE … NX` sets the TTL only when the counter is created, so
 * subsequent hits in the same window don't slide the expiry.
 *
 * Design choice: **fail open.** If Redis is unreachable, unset, or returns
 * anything unexpected, requests are allowed. A limiter outage must never
 * take down login or the widget — availability beats strictness for a v1
 * abuse control. Fail-open events are logged so they're visible.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export interface RateLimitResult {
  /** true = allow the request, false = over the limit for this window */
  ok: boolean;
  /** requests remaining in the current window (0 when over) */
  remaining: number;
  limit: number;
  /** seconds until the window resets (best-effort; = windowSec on a fresh window) */
  resetSec: number;
}

/** Whether the limiter is actually enforcing (both env vars present). */
export function rateLimitEnabled(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

/**
 * Count one hit against `key` and report whether it's within `limit` for
 * the given `windowSec`. Never throws.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return { ok: true, remaining: limit, limit, resetSec: 0 };
  }

  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSec, "NX"],
      ]),
      // Don't let a slow Redis stall a user-facing request.
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) {
      console.error(`rateLimit: Upstash returned ${res.status} — failing open for "${key}".`);
      return { ok: true, remaining: limit, limit, resetSec: 0 };
    }

    const data = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(data?.[0]?.result);
    if (!Number.isFinite(count)) {
      console.error(`rateLimit: unexpected Upstash response for "${key}" — failing open.`, data);
      return { ok: true, remaining: limit, limit, resetSec: 0 };
    }

    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      resetSec: windowSec,
    };
  } catch (err) {
    console.error(`rateLimit: Upstash request failed for "${key}" — failing open.`, err);
    return { ok: true, remaining: limit, limit, resetSec: 0 };
  }
}

/**
 * Best-effort client IP from proxy headers. On Vercel `x-forwarded-for`
 * is a comma-separated list, client first. Falls back to a constant so a
 * missing header buckets everyone together (still bounded) rather than
 * throwing.
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

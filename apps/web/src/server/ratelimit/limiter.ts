import { LocalRateLimiter } from "./localRateLimiter";

/** Singleton local fallback shared across all rateLimit calls. */
const localLimiter = new LocalRateLimiter();

let fallbackReported = false;

export interface RateLimitResult {
  /** true = allow the request, false = over the limit for this window */
  ok: boolean;
  /** requests remaining in the current window (0 when over) */
  remaining: number;
  limit: number;
  /** seconds until the window resets (best-effort; = windowSec on a fresh window) */
  resetSec: number;
}

/** Whether the limiter has Redis credentials configured. */
function redisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}
function redisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

export function rateLimitEnabled(): boolean {
  return Boolean(redisUrl() && redisToken());
}

/**
 * Redact sensitive parts of a rate-limit key for safe logging. Shows enough
 * to distinguish which dimension (ip / key / session / usage) was hit.
 *
 *   wl:ip:192.168.1.99     → "wl:ip:192.168.1.x"
 *   wl:key:abc-def-ghi     → "wl:key:abc-def…"
 *   session:min:org:vis    → "session:min:org:vis…"
 */
function safeKey(key: string): string {
  const parts = key.split(":");
  if (parts.length >= 3 && parts[1] === "ip") {
    const ipParts = parts[2].split(".");
    if (ipParts.length === 4) {
      ipParts[3] = "x";
      return `${parts[0]}:${parts[1]}:${ipParts.join(".")}`;
    }
  }
  if (parts.length >= 3) {
    const prefix = parts.slice(0, 2).join(":");
    const val = parts.slice(2).join(":");
    return val.length > 12 ? `${prefix}:${val.slice(0, 12)}…` : `${prefix}:${val}`;
  }
  return key.length > 24 ? key.slice(0, 24) + "…" : key;
}

/**
 * Count one hit against `key` and report whether it's within `limit` for
 * the given `windowSec`. Never throws.
 *
 * When Redis is reachable the distributed counter is used. On any failure
 * (network error, non-200, unexpected response, or no credentials configured)
 * the system degrades to a local in-memory fixed-window limiter. The fallback
 * uses the same limit parameters so abuse protection is never fully removed,
 * but it is per-process — a multi-instance deploy will see relaxed aggregate
 * limits during a Redis outage.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
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
      if (!fallbackReported) {
        fallbackReported = true;
        console.error(`rateLimit: Upstash returned ${res.status} — local fallback active.`);
      }
      return localLimiter.check(key, limit, windowSec);
    }

    const data = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(data?.[0]?.result);
    if (!Number.isFinite(count)) {
      if (!fallbackReported) {
        fallbackReported = true;
        console.error(`rateLimit: unexpected Upstash response — local fallback active.`, data);
      }
      return localLimiter.check(key, limit, windowSec);
    }

    // Redis recovered — log once.
    if (fallbackReported) {
      fallbackReported = false;
      console.log(`rateLimit: Redis recovered — restored distributed limiting.`);
    }

    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      resetSec: windowSec,
    };
  } catch (err) {
    if (!fallbackReported) {
      fallbackReported = true;
      console.error(`rateLimit: Upstash request failed — local fallback active:`, err);
    }
    return localLimiter.check(key, limit, windowSec);
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

/**
 * Exposed for testing — resets the local limiter state and fallback flag.
 */
export function __resetForTest(): void {
  localLimiter.reset();
  fallbackReported = false;
}

import { createHash } from "crypto";
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
 * Hash rate-limit keys for safe logging so emails/IPs never appear
 * in log output, even partially.
 */
export function safeKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/**
 * Build a composite rate-limit key that scopes attempts by both IP and
 * identity (email hash). This prevents one user's abuse from blocking
 * other users behind the same NAT or proxy IP.
 *
 * @param prefix - e.g. "login" or "signup"
 * @param ip     - the real client IP
 * @param identity - the email or userId to hash into the key
 * @returns a string like "login:{ip}:{hash(email)}"
 */
export function identityKey(prefix: string, ip: string, identity: string): string {
  return `${prefix}:${ip}:${safeKey(identity)}`;
}

/**
 * Format `seconds` as a human-readable string like "12 minutes".
 */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const mins = Math.ceil(seconds / 60);
  return mins === 1 ? "1 minute" : `${mins} minutes`;
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
 * Best-effort client IP from proxy headers. Checks headers in order of
 * trust (Cloudflare → Vercel → fallback) so the real end-user IP is
 * always identified regardless of deployment environment.
 *
 * Header priority:
 *   1. cf-connecting-ip (Cloudflare sets this to the real client IP)
 *   2. x-forwarded-for  (Vercel/standard proxy — comma list, client first)
 *   3. x-real-ip        (fallback for simple reverse-proxy setups)
 *   4. "unknown"        (last resort — avoids throwing)
 */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Debug-log all IP-related headers and the resolved client IP.
 * Call once per request during auth troubleshooting.
 */
export function logIpHeaders(headers: Headers, label: string): void {
  const cf = headers.get("cf-connecting-ip") || "(not set)";
  const xff = headers.get("x-forwarded-for") || "(not set)";
  const xri = headers.get("x-real-ip") || "(not set)";
  const ua = (headers.get("user-agent") || "").slice(0, 80);
  console.log(`[rate-limit] ${label} cf=${cf} xff=${xff} xri=${xri} ua=${ua}`);
}

/**
 * Exposed for testing — resets the local limiter state and fallback flag.
 */
export function __resetForTest(): void {
  localLimiter.reset();
  fallbackReported = false;
}

import { assertPublicUrl } from "@/server/net/ssrfGuard";
import { isCrawlableContentType } from "@/server/website/crawler/sitemap";
import type { FetchErrorInfo, FetchResult } from "@/server/website/crawler/types";
import { normalizeUrl } from "@/server/website/normalizer";

/**
 * Centralized safe fetch for the WHOLE crawler — discovery, robots, sitemap,
 * and page fetching all go through here. Nothing else should perform
 * arbitrary website fetching.
 *
 * Guarantees:
 *  - SSRF-checked at EVERY redirect hop (assertPublicUrl resolves the
 *    host and rejects private/loopback/link-local ranges; a redirect to
 *    internal-ip is rejected even if the original URL was fine).
 *  - per-request timeout
 *  - maximum response byte cap (streamed, aborts early)
 *  - redirect-count cap (loop protection)
 *  - Content-Type filtering (only HTML-family / XML bodies parsed)
 *  - redirect destination host must be the same site as the seed host
 *    (prevents a crawled merchant page from pointing us at someone else's
 *    infrastructure — the concrete SSRF-via-redirect class of bug).
 */

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Seed hostname (effective, no www) — redirects to other sites are rejected. */
  seedHost?: string;
  /** When set, fetch as JSON and allow any host redirect (used for platform JSON endpoints — still SSRF checked per hop). */
  allowCrossHost?: boolean;
}

export function fetchFailure(kind: FetchErrorInfo["kind"], message: string, extra?: Partial<FetchErrorInfo>): FetchErrorInfo {
  return { kind, message, ...extra };
}

/** Narrow a safeFetch result to the success branch (has `ok`). */
export function isFetchResult(r: FetchResult | FetchErrorInfo): r is FetchResult {
  return "ok" in r && "html" in r;
}

/**
 * Fetch a URL body with SSRF + redirect + size + timeout safety.
 * Returns a categorized failure instead of throwing, so orchestration can
 * route to retry/DLQ cleanly. Only resolves when the body was fetched.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<FetchResult | FetchErrorInfo> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let current = rawUrl;
  let redirects = 0;

  try {
    // Validate the first hop (also validates scheme http/https).
    await assertPublicUrl(current);
  } catch {
    return fetchFailure("invalid", "URL rejected by SSRF guard");
  }

  for (;;) {
    // Per-hop check — assertPublicUrl throws ApiError on any private target.
    try {
      await assertPublicUrl(current);
    } catch {
      return fetchFailure("ssrf", `redirect target rejected: ${current}`, { finalUrl: current });
    }

    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let res: Response;
    try {
      controller = new AbortController();
      timer = setTimeout(() => controller!.abort(), timeoutMs);
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "MidevelaBot/1.0 (+https://midevela.com/bot; crawler)",
          Accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        },
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      clearTimeout(timer!);
      return timedOut
        ? fetchFailure("timeout", `fetch timed out after ${timeoutMs}ms`, { finalUrl: current })
        : fetchFailure("network", err instanceof Error ? err.message : "network error");
    } finally {
      clearTimeout(timer!);
    }

    // Redirect handling.
    if (res.status >= 300 && res.status < 400) {
      if (redirects >= maxRedirects) {
        await res.body?.cancel().catch(() => undefined);
        return fetchFailure("redirect_loop", "too many redirects", { finalUrl: current, status: res.status });
      }
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => undefined);
      if (!location) {
        return fetchFailure("network", "redirect without Location header", { status: res.status });
      }
      let next: string;
      try {
        next = new URL(location, current).toString();
      } catch {
        return fetchFailure("invalid", "unparseable redirect Location", { status: res.status });
      }

      // Cross-host redirects are rejected unless the caller opted into any
      // host (platform JSON endpoints) — and even then SSRF still applies.
      const nextHost = (() => {
        try {
          return new URL(next).hostname.toLowerCase().replace(/^www\./, "");
        } catch {
          return "";
        }
      })();
      if (!options.allowCrossHost && options.seedHost) {
        if (nextHost !== options.seedHost.replace(/^www\./, "").toLowerCase()) {
          return fetchFailure("ssrf", `cross-site redirect blocked: ${next}`, { finalUrl: next });
        }
      }

      redirects++;
      current = next;
      continue;
    }

    // Cap bytes while streaming.
    const contentType = res.headers.get("content-type") ?? "";
    if (!options.allowCrossHost && !isCrawlableContentType(contentType)) {
      const base = contentType.split(";")[0].trim().toLowerCase();
      // Allow application/json only for JSON endpoints.
      if (base !== "application/json") {
        await res.body?.cancel().catch(() => undefined);
        return fetchFailure("content_type", `refusing content-type ${base || "unknown"}`, {
          finalUrl: current,
          status: res.status,
        });
      }
    }

    let body = "";
    let tooLarge = false;
    try {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          body += decoder.decode(value, { stream: true });
          if (body.length > maxBytes) {
            tooLarge = true;
            await reader.cancel().catch(() => undefined);
            break;
          }
        }
      } else {
        body = await res.text();
      }
    } catch {
      return fetchFailure("network", "body read error");
    }

    if (tooLarge) {
      return fetchFailure("too_large", `response exceeded ${maxBytes} bytes`, { finalUrl: current, status: res.status });
    }

    if (res.status >= 500 || res.status === 429) {
      return fetchFailure("http_error", `HTTP ${res.status}`, { finalUrl: current, status: res.status });
    }
    if (res.status >= 400) {
      return fetchFailure("http_error", `HTTP ${res.status}`, { finalUrl: current, status: res.status });
    }

    return {
      finalUrl: current,
      status: res.status,
      contentType: contentType.split(";")[0].trim().toLowerCase(),
      html: body,
      ok: true,
      redirects,
    };
  }
}

/** Convenience: fully-fetch a JSON endpoint (same safety). */
export async function safeFetchJson<T>(url: string, options: SafeFetchOptions = {}): Promise<T | null> {
  const result = await safeFetch(url, { ...options, allowCrossHost: options.allowCrossHost ?? true });
  if (!("ok" in result) || !result.ok) return null;
  try {
    return JSON.parse(result.html) as T;
  } catch {
    return null;
  }
}

export { DEFAULT_TIMEOUT_MS, DEFAULT_MAX_BYTES, DEFAULT_MAX_REDIRECTS };
// normalizeUrl kept referenced for symmetric host normalization.
export function seedHostOf(rawUrl: string): string {
  return normalizeUrl(rawUrl);
}
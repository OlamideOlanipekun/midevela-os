import type {
  CrawlStatus,
  CrawlTrigger,
  CrawlPageType,
  CrawlFrontierStatus,
} from "@prisma/client";

/** Priority ordering for URL prioritization — higher priority crawls first. */
export const PagePriority = {
  PRODUCT: 100,
  CATEGORY: 90,
  POLICY: 80,
  FAQ: 70,
  ABOUT: 50,
  CONTACT: 50,
  OTHER: 30,
  BLOG: 10,
} as const;

export function priorityFor(type: CrawlPageType): number {
  return PagePriority[type];
}

export type { CrawlStatus, CrawlTrigger, CrawlPageType, CrawlFrontierStatus };

/** Result of a single safeFetch call. */
export interface FetchResult {
  /** Final URL after redirects (validated at every hop). */
  finalUrl: string;
  /** HTTP status of the final response. */
  status: number;
  /** Content-Type header (lowercased, base type only). */
  contentType: string;
  /** Body text. */
  html: string;
  /** true when the check completed without an error classification below. */
  ok: boolean;
  redirects: number;
}

/** Categorized fetch failure so orchestration can decide retry vs give-up. */
export type FetchFailure =
  | "invalid" // malformed URL / bad scheme
  | "ssrf" // resolved to a private/non-public address at any hop
  | "timeout"
  | "too_large" // exceeded max response bytes
  | "http_error" // permanent HTTP error (404, 410, 4xx/5xx)
  | "network" // DNS/conn refused/aborted — transient
  | "content_type" // non-HTML content we refuse to parse
  | "redirect_loop";

export interface FetchErrorInfo {
  kind: FetchFailure;
  message: string;
  finalUrl?: string;
  status?: number;
}

/**
 * A "page" is safe to follow only if it is:
 *  - the same effective host as the seed (scheme-insensitive)
 *  - http(s)
 * The crawler never follows cross-domain links by design.
 */
export interface DiscoveredUrl {
  url: string;
  normalizedUrl: string;
  depth: number;
  discoveredFrom?: string;
  priority: number;
}

export interface CrawlContext {
  orgId: string;
  websiteId: string;
  crawlId: string;
  seedOrigin: string;
}
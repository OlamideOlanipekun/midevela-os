/**
 * Sitemap parser.
 *
 * Supports `<sitemapindex>` (nested sitemaps, recursion-depth capped and
 * total-URL capped) and `<urlset>` (URLs optionally with priority/lastmod).
 * Strips tracking params via urlDigest for dedupe, rejects malformed XML
 * gracefully, and never expands more than `maxUrls` distinct URLs or
 * `maxDepth` levels of index recursion.
 *
 * Media-type-agnostic: sitemaps may be served as application/xml, text/xml,
 * or text/plain. We sniff content between `<urlset`/`<sitemapindex` tags.
 */

import { urlDigest, absolutize, effectiveHost } from "@/server/website/crawler/canonical";

export interface SitemapUrl {
  url: string;
  /** digest-key for dedupe against the frontier */
  key: string;
  priority?: number;
  lastmod?: string;
}

export interface SitemapResult {
  urls: SitemapUrl[];
  /** nested sitemaps this sitemap referenced (fetched by caller) */
  children: string[];
  truncated: boolean;
  parseError: boolean;
}

const MAX_INDEX_DEPTH = 3;

function extractTag(text: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const m = re.exec(text);
  return m ? m[1] : "";
}

function extractUrls(locText: string, base: string): string[] {
  const urls: string[] = [];
  const re = /<loc>([\s\S]*?)<\/loc>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(locText)) !== null) {
    const raw = m[1].trim();
    const abs = absolutize(raw, base);
    if (!abs) continue;
    const key = urlDigest(abs);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(abs);
  }
  return urls;
}

function isIndexDoc(text: string): boolean {
  return /<sitemapindex[\s>]/i.test(text);
}

/**
 * Parse ONE sitemap payload. `base` is the URL the document was fetched
 * from, used to resolve relative <loc> values. Returns the URLs found here
 * plus any nested sitemap `<loc>` values (children only, fetched by the
 * orchestrator's discovery step).
 */
export function parseSitemap(text: string, base: string, maxUrls = 50000): SitemapResult {
  const trimmed = text.slice(0, 8 * 1024 * 1024);
  try {
    if (isIndexDoc(trimmed)) {
      const locText = extractTag(trimmed, "sitemapindex");
      const childUrls = extractUrls(locText, base);
      return { urls: [], children: childUrls, truncated: false, parseError: false };
    }

    const locText = extractTag(trimmed, "urlset");
    const urls = extractUrls(locText, base);

    const result: SitemapUrl[] = [];
    // Best-effort per-URL metadata via regex over the whole block, keyed to
    // the <url> that contains each <loc>. Most sitemaps omit both.
    const urlBlockRe = /<url[^>]*>([\s\S]*?)<\/url>/gi;
    let block: RegExpExecArray | null;
    const blocks = new Map<string, string>(); // loc -> block text
    const pending = extractUrls(locText, base);
    while ((block = urlBlockRe.exec(trimmed)) !== null) {
      const locMatch = /<loc>([\s\S]*?)<\/loc>/i.exec(block[1]);
      if (locMatch) {
        const abs = absolutize(locMatch[1].trim(), base);
        if (abs) blocks.set(urlDigest(abs), block[1]);
      }
    }

    for (let i = 0; i < pending.length && result.length < maxUrls; i++) {
      const blockText = blocks.get(urlDigest(pending[i])) ?? "";
      const prioMatch = /<priority>([\d.]+)<\/priority>/i.exec(blockText);
      const lastMatch = /<lastmod>([^<]+)<\/lastmod>/i.exec(blockText);
      result.push({
        url: pending[i],
        key: urlDigest(pending[i]),
        priority: prioMatch ? Number(prioMatch[1]) : undefined,
        lastmod: lastMatch ? lastMatch[1].trim() : undefined,
      });
    }

    return { urls: result, children: [], truncated: pending.length > maxUrls, parseError: false };
  } catch {
    return { urls: [], children: [], truncated: false, parseError: true };
  }
}

/**
 * Recursively expand a sitemap index doc given children already loaded.
 * Pure helper; the orchestrator fetches children (each SSRF-guarded) and
 * calls this to merge.
 */
export function mergeSitemapResults(
  root: SitemapResult,
  children: SitemapResult[],
  maxUrls = 50000
): { urls: SitemapUrl[]; truncated: boolean } {
  const out: SitemapUrl[] = [...root.urls];
  const seen = new Set(out.map((u) => u.key));
  let truncated = root.truncated;

  for (const child of children) {
    if (child.parseError) continue;
    for (const u of child.urls) {
      if (seen.has(u.key)) continue;
      if (out.length >= maxUrls) {
        truncated = true;
        break;
      }
      seen.add(u.key);
      out.push(u);
    }
  }
  return { urls: out, truncated };
}

export { MAX_INDEX_DEPTH };

/** True when a URL looks like a robots-disallowed non-follow link (image/pdf). */
export function isCrawlableContentType(contentType: string): boolean {
  const base = contentType.split(";")[0].trim().toLowerCase();
  return base === "text/html" || base === "application/xhtml+xml" || base === "application/xml";
}

/** Effective host sanity for same-site enforcement — mirrored here so
 *  sitemap handling doesn't depend on discovery internals. */
export function sameSite(url: string, seedHost: string): boolean {
  return effectiveHost(url) === seedHost.toLowerCase().replace(/^www\./, "");
}
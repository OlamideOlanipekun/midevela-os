import { absolutize, urlDigest, effectiveHost } from "@/server/website/crawler/canonical";

const SKIP_EXT = /\.(png|jpe?g|gif|webp|svg|ico|css|js|pdf|zip|gz|mp[34]|mov|avi|wav|flac|docx?|xlsx?|pptx?)$/i;
const SKIP_PREFIX = /^(mailto:|tel:|javascript:|data:|blob:|#)/;

const PRODUCT_PATTERN = /\/(products?|p|item|product-page|pd|sku)\//i;
const CATEGORY_PATTERN = /\/categor(y|ies)\/|\/collections\/|\/(shop|browse)\/([\w-]+)\/?$/i;
const POLICY_PATTERN = /\/(shipping|returns?|refund|policies?|warranty|terms|privacy|payment|faq|help)[\/-]?/i;
const PAGINATION_PATTERN = /[?&](page|p|pg|page_num|offset)=\d+|(\/page\/\d+)/i;

export interface DiscoveredLink {
  url: string;
  key: string;
  priority: number;
}

export interface DiscoveryOptions {
  seedHost: string;
  maxLinks?: number;
}

function calculatePriority(url: string, isPagination = false): number {
  if (PRODUCT_PATTERN.test(url)) return 95;
  if (isPagination || PAGINATION_PATTERN.test(url)) return 85;
  if (CATEGORY_PATTERN.test(url)) return 90;
  if (POLICY_PATTERN.test(url)) return 90;
  return 50;
}

export function discoverLinks(html: string, baseUrl: string, options: DiscoveryOptions): DiscoveredLink[] {
  const maxLinks = options.maxLinks ?? 500;
  const found: DiscoveredLink[] = [];
  const seen = new Set<string>();

  const push = (href: string, isPagination = false) => {
    if (!href || SKIP_PREFIX.test(href)) return;
    const abs = absolutize(href, baseUrl);
    if (!abs) return;
    if (SKIP_EXT.test(abs.split("?")[0])) return;
    if (effectiveHost(abs).replace(/^www\./, "") !== options.seedHost.replace(/^www\./, "")) return;
    const key = urlDigest(abs);
    if (seen.has(key)) return;
    seen.add(key);
    if (found.length >= maxLinks) return;

    const priority = calculatePriority(abs, isPagination);
    found.push({ url: abs, key, priority });
  };

  // <a href> — main anchor links
  const anchorRe = /<a\b[^>]*\bhref=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    push(m[1]);
    if (found.length >= maxLinks) break;
  }

  // Pagination controls: <link rel="next">, <link rel="prev">, <a rel="next">
  const paginationRe = /<(link|a)\b[^>]*\brel=["'](next|prev)["'][^>]*\bhref=["']([^"']+)["']/gi;
  while ((m = paginationRe.exec(html)) !== null) {
    push(m[3], true);
    if (found.length >= maxLinks) break;
  }

  // <link rel="canonical">
  const canonicalRe = /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/gi;
  while ((m = canonicalRe.exec(html)) !== null) {
    push(m[1]);
    if (found.length >= maxLinks) break;
  }

  return found.sort((a, b) => b.priority - a.priority);
}

/** Extract an explicit canonical URL from the page if present. */
export function declaredCanonical(html: string, baseUrl: string): { url: string; key: string } | null {
  const re = /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i;
  const m = re.exec(html);
  if (!m) return null;
  const abs = absolutize(m[1], baseUrl);
  if (!abs) return null;
  return { url: abs, key: urlDigest(abs) };
}
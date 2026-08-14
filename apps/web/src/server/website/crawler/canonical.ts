/**
 * URL normalization + canonicalization for the crawl frontier.
 *
 * Two distinct concepts:
 *  - `canonicalizeUrl`: the page-level canonical URL we persist (this is the
 *    <link rel="canonical"> value when present, else the normalized URL).
 *  - `normalizeUrlDigest`: the frontier dedupe key (scheme/host/trailing-slash
 *    normalized, query stripped of tracking noise but NOT dropped entirely).
 *
 * Everything here is pure and deterministic so the crawl is resumable: the
 * same input URL always produces the same digest.
 */

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
  "spm", // Taobao/AliExpress
  "scm",
  "zenid",
  "PHPSESSID",
]);

const DEFAULT_PORTS = new Map([
  ["http:", "80"],
  ["https:", "443"],
]);

/**
 * Frontier dedupe digest. Normalizes scheme to lowercase, hostname to
 * lowercase, strips default ports, removes trailing slash, drops known
 * tracking query params, sorts remaining params, and removes fragments.
 * Keeps the path & query so distinct real pages stay distinct.
 */
export function urlDigest(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    // Unparseable URLs can never be crawled — give them a stable digest
    // derived from the raw string so they dedupe against themselves.
    return `invalid::${raw.trim().toLowerCase()}`;
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return `invalid::${raw.trim().toLowerCase()}`;
  }

  const host = url.hostname.toLowerCase();
  const defaultPort = DEFAULT_PORTS.get(protocol);
  const portStr = url.port && url.port !== defaultPort ? `:${url.port}` : "";
  const authority = `${host}${portStr}`;

  const params = Array.from(url.searchParams.entries())
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  const query = params ? `?${params}` : "";
  return `${protocol}//${authority}${path}${query}`;
}

/** Strips the URL down to origin only (used for seed/host comparison). */
export function originOf(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname.toLowerCase()}`;
  } catch {
    return "";
  }
}

/** Effective hostname (no scheme, lowercase, no www). Used to test
 *  whether a discovered link belongs to the same site as the seed. */
export function effectiveHost(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Resolve a possibly-relative href against a base URL and normalize it.
 * Returns "" when the result isn't an http(s) absolute URL.
 */
export function absolutize(href: string, base: string): string {
  try {
    const url = new URL(href, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * pageKey for the WebsitePage unique constraint — the canonical value we
 * store. Prefers an explicit <link rel="canonical"> URL from the page when
 * the caller passes it; otherwise falls back to the digest (canonicalized).
 */
export function canonicalUrlFor(raw: string, declaredCanonical?: string): string {
  const declared = declaredCanonical ? canonicalizeDeclared(declaredCanonical, raw) : "";
  return declared || urlDigest(raw);
}

/** Normalize a declared canonical link — must share the raw URL's host, or
 *  we ignore it (cross-domain canonical declarations shouldn't re-key a page
 *  that the crawler actually fetched. */
function canonicalizeDeclared(declared: string, actual: string): string {
  const d = urlDigest(declared);
  if (d.startsWith("invalid::")) return "";
  if (effectiveHost(d) !== effectiveHost(actual)) return "";
  return d;
}
/**
 * Normalises a raw URL to a canonical domain-only form for the Website
 * Registry.  Every variant of a merchant's URL maps to exactly one value.
 *
 * Examples:
 *   https://www.jumia.com       → jumia.com
 *   https://jumia.com/           → jumia.com
 *   http://jumia.com             → jumia.com
 *   jumia.com                    → jumia.com
 *   https://shop.jumia.com/p?q=1 → shop.jumia.com
 */
export function normalizeUrl(raw: string): string {
  let url = raw.trim();

  // Prepend scheme so the URL constructor works for bare domains
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  // Strip leading www.
  hostname = hostname.replace(/^www\./, "");

  return hostname;
}

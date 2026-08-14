/**
 * robots.txt parser + rule enforcement.
 *
 * Handles the agent group we care about ("MidevelaBot"), falls back to "*"
 * when there is no specific group, supports Allow/Disallow (match longest),
 * Sitemap directives, and robots failures are surfaced to the caller so
 * orchestration can decide whether to skip robots-dependent pages.
 */

export interface RobotsRules {
  /** Allowed path prefixes (longest-prefix match wins over disallow). */
  allow: string[];
  /** Disallowed path prefixes. */
  disallow: string[];
  /** Sitemap URLs declared (even for other agents — sitemaps aren't agent-scoped). */
  sitemaps: string[];
  /** true when robots.txt resolved (200, even empty). false on fetch error. */
  available: boolean;
  /** e.g. "missing" | "forbidden" | "timeout" | "network" */
  reason?: string;
}

const MAX_ROBOTS_BYTES = 512 * 1024;

/** Split into groups keyed by user-agent directive. */
function parseGroups(text: string): Map<string, { allow: string[]; disallow: string[] }> {
  const groups = new Map<string, { allow: string[]; disallow: string[] }>();
  let currentAgent = "*";
  let current = { allow: [] as string[], disallow: [] as string[] };
  groups.set(currentAgent, current);

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      currentAgent = value.toLowerCase();
      current = groups.get(currentAgent) ?? { allow: [], disallow: [] };
      groups.set(currentAgent, current);
      continue;
    }
    if (key === "allow") current.allow.push(globToPrefix(value));
    else if (key === "disallow" && value !== "") current.disallow.push(globToPrefix(value));
    // "Disallow:" (empty) means allow everything — represented by no disallow rule.
  }
  return groups;
}

/** Convert robots glob to a prefix match: strip trailing fragments for
 *  simplicity, resolve `*` (matches anything) and `$` (end anchor) into a
 *  prefix when possible. Full RFC-9309 wildcard matching is a stretch goal —
 *  prefix matching covers the overwhelming majority of real robots files. */
function globToPrefix(pattern: string): string {
  let p = pattern;
  if (p.startsWith("/") === false) p = `/${p}`;
  // "$" end anchor: a trailing $ makes it a full-path exact match prefix.
  if (p.endsWith("$")) {
    p = p.slice(0, -1);
    return p;
  }
  // Any "*" or other wildcard short-circuits to a plain prefix up to the wildcard.
  const star = p.indexOf("*");
  if (star >= 0) return p.slice(0, star);
  return p;
}

/** Longest-prefix-match evaluation of one path against a group's rules. */
export function isPathAllowed(path: string, group: { allow: string[]; disallow: string[] }): boolean {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  let best = -1; // longest matched rule length
  let allowed = true;

  const consider = (prefix: string, allowRule: boolean) => {
    const rule = prefix.startsWith("/") ? prefix : `/${prefix}`;
    if (!cleanPath.startsWith(rule)) return;
    if (rule.length > best) {
      best = rule.length;
      allowed = allowRule;
    }
  };

  for (const rule of group.disallow) consider(rule, false);
  for (const rule of group.allow) consider(rule, true);

  return allowed;
}

/**
 * Build rules for our bot. `text` is the raw robots.txt body (already SSRF
 * checked by the fetcher). We honor both "midevelabot" and "*", using the
 * bot-specific group when it exists (and prefer its rules wholesale).
 */
export function parseRobots(text: string, agent = "midevelabot"): RobotsRules {
  const groups = parseGroups(text);
  const botGroup = groups.get(agent.toLowerCase());
  const wildcard = groups.get("*");

  const group = botGroup ?? wildcard ?? { allow: [], disallow: [] };
  const sitemaps: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    if (line.slice(0, idx).trim().toLowerCase() === "sitemap") {
      const value = line.slice(idx + 1).trim();
      if (value) sitemaps.push(value);
    }
  }

  const dedupe = <T>(arr: T[]): T[] => Array.from(new Set(arr));

  return {
    allow: dedupe(group.allow),
    disallow: dedupe(group.disallow),
    sitemaps: dedupe(sitemaps).slice(0, 100),
    available: true,
  };
}

export function emptyRobots(missing: boolean): RobotsRules {
  return { allow: [], disallow: [], sitemaps: [], available: false, reason: missing ? "missing" : "forbidden" };
}

export { MAX_ROBOTS_BYTES, parseGroups };
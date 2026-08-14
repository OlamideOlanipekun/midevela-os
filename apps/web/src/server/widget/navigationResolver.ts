/**
 * Navigation Resolver — Milestone A (A6)
 *
 * Resolves natural-language navigation requests into verified merchant page URLs
 * sourced from the WebsitePage and Category datasets.
 *
 * Pipeline:
 *   User message (e.g. "Take me to men's shoes")
 *       ↓
 *   Extract navigation intent + target label
 *       ↓
 *   Search WebsitePage (CATEGORY, PRODUCT) records
 *       ↓
 *   Return verified URL (or null if not found)
 *
 * Only returns URLs that exist in the crawled WebsitePage table.
 * Never fabricates or guesses URLs.
 *
 * Returns a NavigationResult with:
 *   • targetUrl    — verified page URL from WebsitePage
 *   • targetTitle  — human-readable page name
 *   • pageType     — CATEGORY | PRODUCT | POLICY | FAQ etc.
 *   • replyText    — assistant message to display before navigating
 *   • confidence   — 0–1 match confidence
 */

import prisma from "@/lib/prisma";

export type NavigationResult = {
  targetUrl: string;
  targetTitle: string;
  pageType: string;
  replyText: string;
  confidence: number;
};

// ─── Intent detection patterns ────────────────────────────────────────────────

const NAV_PATTERNS = [
  /\b(?:take\s+me\s+to|go\s+to|navigate\s+to|open|show\s+me|browse\s+to|visit|bring\s+me\s+to)\s+(?:the\s+)?(.+)/i,
  /\b(?:i\s+want\s+to\s+see|let\s+me\s+see|show\s+me)\s+(?:the\s+)?(.+?)(?:\s+page|\s+section|\s+category)?$/i,
  /\bwhere\s+(?:can\s+I\s+find|is)\s+(?:the\s+)?(.+?)(?:\s+page|\s+section|\s+category)?$/i,
];

// Canonical stop-words to strip from target label for cleaner matching
const STOP_WORDS = /\b(page|section|category|all|the|your|their|some|a|an|our)\b/gi;

/**
 * Detects if a user message is a navigation request and extracts the target label.
 *
 * @returns The extracted navigation target label, or null if not a nav request.
 */
export function extractNavigationTarget(message: string): string | null {
  const trimmed = message.trim();
  for (const pattern of NAV_PATTERNS) {
    const m = pattern.exec(trimmed);
    if (m) {
      const raw = m[1]?.trim().replace(STOP_WORDS, "").trim();
      if (raw && raw.length >= 2) return raw;
    }
  }
  return null;
}

/**
 * Resolves a navigation target label to a verified merchant URL.
 *
 * Search order:
 *   1. Category name in DB (exact, then fuzzy)
 *   2. WebsitePage title/URL fuzzy match (category and product pages)
 *   3. Policy / FAQ pages (shipping, returns, contact, etc.)
 *
 * Returns null if no match found with sufficient confidence.
 */
export async function resolveNavigation(
  orgId: string,
  targetLabel: string
): Promise<NavigationResult | null> {
  if (!targetLabel || targetLabel.length < 2) return null;

  const label = targetLabel.toLowerCase().trim();

  // ── 1. Category lookup — exact then fuzzy ────────────────────────────────
  const categories = await prisma.category.findMany({
    where: { orgId },
    select: { id: true, name: true, slug: true },
    take: 50,
  });

  // Exact category name match
  const exactCat = categories.find((c) => c.name.toLowerCase() === label);
  if (exactCat) {
    const page = await findPageForCategory(orgId, exactCat.name, exactCat.slug);
    if (page) {
      return {
        targetUrl: page.url,
        targetTitle: exactCat.name,
        pageType: "CATEGORY",
        replyText: `Taking you to **${exactCat.name}** now.`,
        confidence: 1.0,
      };
    }
  }

  // Fuzzy category match: label is contained in category name or vice versa
  const fuzzyCat = categories.find(
    (c) =>
      c.name.toLowerCase().includes(label) ||
      label.includes(c.name.toLowerCase())
  );
  if (fuzzyCat) {
    const page = await findPageForCategory(orgId, fuzzyCat.name, fuzzyCat.slug);
    if (page) {
      return {
        targetUrl: page.url,
        targetTitle: fuzzyCat.name,
        pageType: "CATEGORY",
        replyText: `Taking you to **${fuzzyCat.name}** now.`,
        confidence: 0.85,
      };
    }
  }

  // ── 2. WebsitePage title / URL fuzzy match ───────────────────────────────
  // Priority: CATEGORY > PRODUCT > POLICY > FAQ > OTHER
  const pages = await prisma.websitePage.findMany({
    where: {
      orgId,
      httpStatus: { in: [200, null] },
      OR: [
        { title: { contains: label, mode: "insensitive" } },
        { url: { contains: label.replace(/\s+/g, "-"), mode: "insensitive" } },
        { url: { contains: label.replace(/\s+/g, "_"), mode: "insensitive" } },
        { canonicalUrl: { contains: label.replace(/\s+/g, "-"), mode: "insensitive" } },
      ],
    },
    select: { url: true, title: true, pageType: true, canonicalUrl: true },
    take: 10,
  });

  if (pages.length > 0) {
    // Rank by page type priority
    const rankOrder: Record<string, number> = {
      CATEGORY: 10,
      PRODUCT: 7,
      POLICY: 5,
      FAQ: 5,
      ABOUT: 3,
      CONTACT: 3,
      BLOG: 2,
      OTHER: 1,
    };
    const ranked = [...pages].sort(
      (a, b) => (rankOrder[b.pageType] ?? 0) - (rankOrder[a.pageType] ?? 0)
    );
    const best = ranked[0];
    const title = best.title || titleFromUrl(best.url);
    const confidence = computeUrlConfidence(label, best.url, best.title);

    if (confidence >= 0.6) {
      return {
        targetUrl: best.canonicalUrl || best.url,
        targetTitle: title,
        pageType: best.pageType,
        replyText: buildNavReply(title, best.pageType),
        confidence,
      };
    }
  }

  // ── 3. Well-known policy/help page keywords ──────────────────────────────
  const POLICY_KEYWORDS: Record<string, string> = {
    shipping: "POLICY",
    delivery: "POLICY",
    return: "POLICY",
    refund: "POLICY",
    exchange: "POLICY",
    warranty: "POLICY",
    contact: "CONTACT",
    "about us": "ABOUT",
    about: "ABOUT",
    faq: "FAQ",
    help: "FAQ",
    "privacy policy": "POLICY",
    terms: "POLICY",
    payment: "POLICY",
  };

  for (const [keyword, type] of Object.entries(POLICY_KEYWORDS)) {
    if (label.includes(keyword)) {
      const policyPage = await prisma.websitePage.findFirst({
        where: {
          orgId,
          pageType: type as any,
        },
        select: { url: true, title: true, pageType: true, canonicalUrl: true },
        orderBy: { lastSuccessfulCrawlAt: "desc" },
      });
      if (policyPage) {
        const title = policyPage.title || titleFromUrl(policyPage.url);
        return {
          targetUrl: policyPage.canonicalUrl || policyPage.url,
          targetTitle: title,
          pageType: policyPage.pageType,
          replyText: buildNavReply(title, policyPage.pageType),
          confidence: 0.75,
        };
      }
    }
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findPageForCategory(
  orgId: string,
  categoryName: string,
  slug: string | null
): Promise<{ url: string; canonicalUrl: string } | null> {
  // Try to find a WebsitePage whose URL/title matches the category name or slug
  const searchTerms = [
    categoryName.toLowerCase().replace(/\s+/g, "-"),
    categoryName.toLowerCase().replace(/\s+/g, "_"),
    categoryName.toLowerCase().replace(/\s+/g, ""),
    slug || "",
  ].filter(Boolean);

  for (const term of searchTerms) {
    if (!term) continue;
    const page = await prisma.websitePage.findFirst({
      where: {
        orgId,
        pageType: "CATEGORY",
        OR: [
          { url: { contains: term, mode: "insensitive" } },
          { canonicalUrl: { contains: term, mode: "insensitive" } },
          { title: { contains: categoryName, mode: "insensitive" } },
        ],
      },
      select: { url: true, canonicalUrl: true },
      orderBy: { depth: "asc" }, // prefer shallower / top-level pages
    });
    if (page) return page;
  }
  return null;
}

function titleFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const segment = pathname.split("/").filter(Boolean).pop() || "";
    return segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || url;
  } catch {
    return url;
  }
}

function computeUrlConfidence(label: string, url: string, title: string | null): number {
  const normUrl = url.toLowerCase();
  const normTitle = (title || "").toLowerCase();
  const normLabel = label.toLowerCase();

  if (normTitle === normLabel || normUrl.includes(normLabel)) return 0.95;
  if (normTitle.includes(normLabel) || normLabel.includes(normTitle)) return 0.8;

  // Word overlap
  const labelWords = normLabel.split(/\s+/);
  const titleWords = normTitle.split(/\s+|\-|_/);
  const overlap = labelWords.filter((w) => titleWords.includes(w)).length;
  return Math.min(0.75, overlap / labelWords.length);
}

function buildNavReply(title: string, pageType: string): string {
  switch (pageType) {
    case "CATEGORY":
      return `Taking you to **${title}** now.`;
    case "PRODUCT":
      return `Opening **${title}** for you.`;
    case "POLICY":
    case "FAQ":
      return `Opening the **${title}** page.`;
    case "CONTACT":
      return `Taking you to the **Contact** page.`;
    case "ABOUT":
      return `Opening the **About** page.`;
    default:
      return `Navigating to **${title}**.`;
  }
}

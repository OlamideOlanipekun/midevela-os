/**
 * Website Context Resolver — Milestone A (A3)
 *
 * Resolves the shopper's current URL into structured context from the
 * Website Intelligence dataset (WebsitePage + Product tables).
 *
 * Pipeline:
 *   currentUrl (from widget)
 *       ↓
 *   Normalize + match WebsitePage
 *       ↓
 *   If PRODUCT page → fetch Product record
 *       ↓
 *   If CATEGORY page → find category in DB
 *       ↓
 *   Return PageContext { pageType, product, category, url }
 *
 * This context is injected into chat turns so queries like:
 *   "Do you have something cheaper?"
 * automatically anchor to the active product's price and category without
 * requiring the shopper to describe it.
 *
 * IMPORTANT: Only reads verified data from WebsitePage/Product tables.
 * The LLM never decides whether a product costs a specific amount — the DB does.
 */

import prisma from "@/lib/prisma";

export type PageContext = {
  /** Raw URL sent by the widget */
  url: string;
  /** CrawlPageType: PRODUCT, CATEGORY, POLICY, FAQ, etc. — or null if no page found */
  pageType: string | null;
  /** Matched WebsitePage record title */
  pageTitle: string | null;
  /** If the page is a product page, the resolved Product record */
  product: ActiveProductContext | null;
  /** If the page is a category page, the category name from the DB */
  categoryName: string | null;
  /** If the page is a category page, the category ID from the DB */
  categoryId: string | null;
};

export type ActiveProductContext = {
  id: string;
  name: string;
  price: number;
  currency: string;
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  inventoryStatus: string;
  sourceUrl: string | null;
};

export type EmptyContext = {
  url: string;
  pageType: null;
  pageTitle: null;
  product: null;
  categoryName: null;
  categoryId: null;
};

/**
 * Resolves a merchant page URL to structured context.
 *
 * @param orgId     The merchant's organization ID (from WidgetKey)
 * @param currentUrl The shopper's current page URL (from widget postMessage)
 */
export async function resolvePageContext(
  orgId: string,
  currentUrl: string | null | undefined
): Promise<PageContext | EmptyContext> {
  const empty: EmptyContext = {
    url: currentUrl || "",
    pageType: null,
    pageTitle: null,
    product: null,
    categoryName: null,
    categoryId: null,
  };

  if (!currentUrl) return empty;

  // Normalize: strip query string and fragment for matching
  let normalizedUrl = currentUrl.trim();
  try {
    const parsed = new URL(currentUrl);
    // Keep path + hostname for matching; strip utm_* and tracking params
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("utm_content");
    parsed.searchParams.delete("utm_term");
    parsed.searchParams.delete("ref");
    parsed.searchParams.delete("fbclid");
    parsed.searchParams.delete("gclid");
    normalizedUrl = parsed.toString();
  } catch {
    // Not a valid URL — return empty context
    return empty;
  }

  // ── Step 1: Match against WebsitePage table ──────────────────────────────
  // Try exact match first, then prefix/suffix match for dynamic segments
  let page = await prisma.websitePage.findFirst({
    where: {
      orgId,
      OR: [
        { url: normalizedUrl },
        { canonicalUrl: normalizedUrl },
        { url: currentUrl },
        { canonicalUrl: currentUrl },
      ],
    },
    select: {
      pageType: true,
      title: true,
      url: true,
      canonicalUrl: true,
      metadata: true,
    },
  });

  // Fuzzy fallback: strip protocol+host, match by path only
  if (!page) {
    try {
      const { pathname } = new URL(normalizedUrl);
      if (pathname && pathname !== "/") {
        page = await prisma.websitePage.findFirst({
          where: {
            orgId,
            OR: [
              { url: { contains: pathname } },
              { canonicalUrl: { contains: pathname } },
            ],
          },
          orderBy: { lastSuccessfulCrawlAt: "desc" },
          select: {
            pageType: true,
            title: true,
            url: true,
            canonicalUrl: true,
            metadata: true,
          },
        });
      }
    } catch {
      // URL parsing failed — skip
    }
  }

  if (!page) return empty;

  const pageType = page.pageType as string;

  // ── Step 2: Resolve product context if it's a product page ──────────────
  if (pageType === "PRODUCT") {
    // Find the product whose sourceUrl matches this page URL
    const product = await prisma.product.findFirst({
      where: {
        orgId,
        sourceUrl: {
          in: [page.url, page.canonicalUrl, normalizedUrl, currentUrl].filter(Boolean) as string[],
        },
        inventoryStatus: { not: "OUT_OF_STOCK" },
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (product) {
      return {
        url: currentUrl,
        pageType,
        pageTitle: page.title || product.name,
        product: {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          currency: product.currency,
          categoryId: product.categoryId || null,
          categoryName: product.category?.name || null,
          brand: product.brand || null,
          inventoryStatus: product.inventoryStatus,
          sourceUrl: product.sourceUrl || null,
        },
        categoryName: product.category?.name || null,
        categoryId: product.categoryId || null,
      };
    }

    // Product page found in crawl data but no matching product record yet
    return {
      url: currentUrl,
      pageType,
      pageTitle: page.title || null,
      product: null,
      categoryName: null,
      categoryId: null,
    };
  }

  // ── Step 3: Resolve category context if it's a category page ────────────
  if (pageType === "CATEGORY") {
    // Category name is usually stored in the page title or metadata
    const meta = (page.metadata ?? {}) as Record<string, unknown>;
    const categoryName =
      (typeof meta.categoryName === "string" ? meta.categoryName : null) ||
      page.title ||
      null;

    // Try to match against a Category record in the DB
    let categoryId: string | null = null;
    if (categoryName) {
      const cat = await prisma.category.findFirst({
        where: {
          orgId,
          name: { equals: categoryName, mode: "insensitive" },
        },
        select: { id: true, name: true },
      });
      if (cat) {
        categoryId = cat.id;
      }
    }

    return {
      url: currentUrl,
      pageType,
      pageTitle: page.title || null,
      product: null,
      categoryName,
      categoryId,
    };
  }

  // ── All other page types (POLICY, FAQ, ABOUT, CONTACT, BLOG, OTHER) ─────
  return {
    url: currentUrl,
    pageType,
    pageTitle: page.title || null,
    product: null,
    categoryName: null,
    categoryId: null,
  };
}

/**
 * Builds a natural-language context hint for the LLM from a resolved PageContext.
 * Injected into the system prompt so the AI knows what the shopper is looking at.
 */
export function buildContextHint(ctx: PageContext | EmptyContext): string | null {
  if (!ctx.pageType) return null;

  const parts: string[] = [];

  if (ctx.pageType === "PRODUCT" && ctx.product) {
    parts.push(`The shopper is currently viewing the product: "${ctx.product.name}"`);
    parts.push(`Price: ${ctx.product.currency} ${ctx.product.price.toLocaleString()}`);
    if (ctx.product.categoryName) parts.push(`Category: ${ctx.product.categoryName}`);
    if (ctx.product.brand) parts.push(`Brand: ${ctx.product.brand}`);
    parts.push(`Inventory: ${ctx.product.inventoryStatus}`);
  } else if (ctx.pageType === "CATEGORY" && ctx.categoryName) {
    parts.push(`The shopper is currently browsing the category: "${ctx.categoryName}"`);
  } else if (ctx.pageTitle) {
    parts.push(`The shopper is on the page: "${ctx.pageTitle}" (${ctx.pageType})`);
  }

  return parts.length > 0 ? parts.join(". ") + "." : null;
}

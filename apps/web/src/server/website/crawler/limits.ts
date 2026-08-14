import { getPlanCaps, isUnlimited, remainingBudget } from "@/server/billing/caps";
import { UNLIMITED } from "@/server/billing/caps";

/**
 * Crawl safety limits — multiple INDEPENDENT ceilings so that a single
 * merchant can never accidentally (or maliciously) trigger an unbounded
 * crawl. These are enforced per crawl in orchestrator.ts and per fetch in
 * fetcher.ts.
 *
 * Defaults target a typical small-medium storefront. Plans can raise them
 * through the plan caps that already exist (productCap) plus per-plan
 * overrides below (page/knowledge multipliers are derived from productCap
 * so billing remains the single source of truth).
 */

export interface CrawlLimits {
  maxPages: number;
  maxDepth: number;
  maxProducts: number;
  maxKnowledgePages: number;
  maxCrawlDurationMs: number;
  maxResponseBytes: number;
  maxRedirects: number;
  maxConcurrentPages: number;
  maxLLMCalls: number;
  maxEmbeddingWrites: number;
  maxSitemapUrls: number;
}

/** Hard floor/ceil so a misconfigured DB value can't produce insane limits. */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.floor(value)));

/** Map a plan's monthly product cap onto a page ceiling. */
function pagesFromPlanProducts(productCap: number): number {
  if (isUnlimited(productCap) || productCap === 0) return 12000;
  // Assume roughly 3 non-product pages (home, categories, policies) per
  // product page for typical stores.
  return clamp(productCap * 3, 200, 60000);
}

const DEFAULT_LIMITS: CrawlLimits = {
  maxPages: 4000,
  maxDepth: 6,
  maxProducts: 2000,
  maxKnowledgePages: 500,
  maxCrawlDurationMs: 10 * 60 * 1000, // 10 minutes wall-clock cap
  maxResponseBytes: 5 * 1024 * 1024, // 5 MB per page
  maxRedirects: 5,
  maxConcurrentPages: 4,
  maxLLMCalls: 400,
  maxEmbeddingWrites: 4000,
  maxSitemapUrls: 50000,
};

/**
 * Resolve effective limits for an org, deriving page/product ceilings from
 * the subscribed plan's productCap (UNLIMITED → generous defaults).
 */
export async function resolveCrawlLimits(orgId: string): Promise<CrawlLimits> {
  const { productCap, knowledgeCap } = await getPlanCaps(orgId);

  const maxProducts =
    productCap === UNLIMITED
      ? DEFAULT_LIMITS.maxProducts
      : clamp(productCap, 10, 100000);

  return {
    ...DEFAULT_LIMITS,
    maxProducts,
    maxPages: Math.min(DEFAULT_LIMITS.maxPages, pagesFromPlanProducts(maxProducts)),
    maxKnowledgePages: clamp(
      isUnlimited(knowledgeCap) ? 500 : Math.max(50, Math.min(knowledgeCap * 5, 2000)),
      10,
      2000
    ),
  };
}

/** Cheap pure split-out so unit tests don't need a DB. */
export function resolveCrawlLimitsFromCap(productCap: number, knowledgeCap: number): CrawlLimits {
  const maxProducts =
    productCap === UNLIMITED
      ? DEFAULT_LIMITS.maxProducts
      : clamp(productCap, 10, 100000);

  return {
    ...DEFAULT_LIMITS,
    maxProducts,
    maxPages: Math.min(DEFAULT_LIMITS.maxPages, pagesFromPlanProducts(maxProducts)),
    maxKnowledgePages: clamp(
      isUnlimited(knowledgeCap) ? 500 : Math.max(50, Math.min(knowledgeCap * 5, 2000)),
      10,
      2000
    ),
  };
}

export { remainingBudget };
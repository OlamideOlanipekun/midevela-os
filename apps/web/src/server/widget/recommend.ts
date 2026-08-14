import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { formatMoney } from "@/server/catalog/money";
import { embedText } from "@/server/conversation/embeddings";
import { safeHttpUrl, firstImageUrl } from "@/server/retrieval/search";
import { passesHardConstraints } from "@/server/catalog/filtering";
import type { ParsedConstraints } from "@/server/widget/intentEngine";

const MAX_RESULTS = 5;
const MAX_CANDIDATES = 60;

export interface RecommendedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: string;
  /** Raw numeric price for constraint validation & explain.ts */
  priceRaw: number;
  currency: string;
  imageUrl: string | null;
  url: string | null;
  inStock: boolean;
  category?: string | null;
  attributes?: Record<string, unknown>;
}

export interface RecommendInput {
  orgId: string;
  categoryId: string;
  answers: Record<string, string>;
  /**
   * B3/B13: Structured hard constraints extracted by the intent engine.
   * These are ALWAYS applied before vector ranking — a ₦150k product
   * never appears when maxPrice = ₦100k.
   */
  constraints?: ParsedConstraints;
}

// ── Merchant controls (B14) ──────────────────────────────────────────────────

interface MerchantRecommendSettings {
  onlyRecommendAvailable: boolean;
  respectCustomerBudget: boolean;
  prioritizeInStock: boolean;
  showSimilarProducts: boolean;
  allowProductComparisons: boolean;
  /** "relevance" | "best_value" | "new_arrivals" | "best_sellers" */
  rankingPreference: string;
  /** "best_match" | "best_value" | "new_arrivals" | "best_sellers" */
  promoteMode: string;
}

function readMerchantSettings(settings: unknown): MerchantRecommendSettings {
  const s = (typeof settings === "object" && settings !== null ? settings : {}) as Record<string, unknown>;
  return {
    onlyRecommendAvailable: s.onlyRecommendAvailable !== false,
    respectCustomerBudget: s.respectCustomerBudget !== false,
    prioritizeInStock: s.prioritizeInStock !== false,
    showSimilarProducts: s.showSimilarProducts !== false,
    allowProductComparisons: s.allowProductComparisons !== false,
    rankingPreference: typeof s.rankingPreference === "string" ? s.rankingPreference : "relevance",
    promoteMode: typeof s.promoteMode === "string" ? s.promoteMode : "best_match",
  };
}

// ── Budget helpers ────────────────────────────────────────────────────────────

function parseBudget(value: string | undefined): { min: number; max: number | null } | null {
  if (!value) return null;
  const [minStr, maxStr] = value.split("-");
  const min = Number(minStr);
  if (!Number.isFinite(min)) return null;
  const max = maxStr ? Number(maxStr) : null;
  return { min, max: max !== null && Number.isFinite(max) ? max : null };
}

async function dominantCurrencyForCategory(
  orgId: string,
  categoryIds: string[],
  fallbackCurrency: string
): Promise<string> {
  const products = await prisma.product.findMany({
    where: {
      orgId,
      categoryId: { in: categoryIds },
      inventoryStatus: { not: "OUT_OF_STOCK" },
    },
    select: { price: true, currency: true },
  });

  const active = products.filter(
    (p) => Number.isFinite(Number(p.price)) && Number(p.price) > 0
  );
  if (active.length === 0) return fallbackCurrency;

  const counts = new Map<string, number>();
  let dominant = fallbackCurrency;
  let maxCount = 0;
  for (const p of active) {
    const c = p.currency ?? fallbackCurrency;
    const count = (counts.get(c) ?? 0) + 1;
    counts.set(c, count);
    if (count > maxCount) { maxCount = count; dominant = c; }
  }
  return dominant;
}

// ── Multi-factor ranking (B13) ────────────────────────────────────────────────

interface ScoredCandidate {
  id: string;
  priceRaw: number;
  currency: string;
  inStock: boolean;
  createdAt: Date;
  vectorScore: number;
  finalScore: number;
}

/**
 * Compute multi-factor ranking score. Hard constraints must have already
 * been applied before calling this — this function ranks, not filters.
 *
 * Score = vector_similarity * 0.5
 *       + in_stock_bonus * 0.2
 *       + price_fit_score * 0.2
 *       + recency_bonus * 0.1
 */
function computeRankScore(
  candidate: Omit<ScoredCandidate, "finalScore">,
  vectorScore: number,
  constraints: ParsedConstraints | undefined,
  settings: MerchantRecommendSettings
): number {
  let score = vectorScore * 0.5;

  // In-stock bonus
  if (candidate.inStock && settings.prioritizeInStock) {
    score += 0.2;
  }

  // Price fit: closer to max budget = better fit (budget shoppers want maximum value)
  if (constraints?.maxPrice && candidate.priceRaw > 0) {
    const fit = Math.min(candidate.priceRaw, constraints.maxPrice) / constraints.maxPrice;
    score += fit * 0.2;
  } else {
    score += 0.1; // neutral
  }

  // Recency bonus (for new_arrivals mode)
  if (settings.promoteMode === "new_arrivals" || settings.rankingPreference === "new_arrivals") {
    const ageMs = Date.now() - candidate.createdAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - ageDays / 90); // decays over 90 days
    score += recencyScore * 0.1;
  }

  // Best-value mode: penalise higher prices relative to category
  if (settings.promoteMode === "best_value" || settings.rankingPreference === "best_value") {
    if (constraints?.maxPrice && candidate.priceRaw > 0) {
      const valueScore = 1 - candidate.priceRaw / constraints.maxPrice;
      score += Math.max(0, valueScore) * 0.1;
    }
  }

  return score;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Deterministic hard filter + multi-factor semantic ranking.
 *
 * Pipeline:
 *   1. Read merchant controls from Organization.settings
 *   2. Candidate generation (category + children)
 *   3. Hard filtering: availability, budget, brand, color, style
 *   4. Vector similarity ranking
 *   5. Multi-factor score = vector * 0.5 + stock * 0.2 + priceFit * 0.2 + recency * 0.1
 *   6. Merchant ranking preference applied
 *   7. Return top N
 *
 * Hard constraints ALWAYS win — a product above maxPrice is never returned,
 * regardless of semantic relevance.
 */
export async function recommendProducts(input: RecommendInput): Promise<RecommendedProduct[]> {
  const [category, org] = await Promise.all([
    prisma.category.findFirst({ where: { id: input.categoryId, orgId: input.orgId } }),
    prisma.organization.findUnique({ where: { id: input.orgId }, select: { currency: true, settings: true } }),
  ]);
  if (!category) throw new ApiError(404, "Category not found.");

  const merchantSettings = readMerchantSettings(org?.settings);
  const orgCurrency = org?.currency ?? "NGN";

  const children = await prisma.category.findMany({
    where: { parentId: category.id, orgId: input.orgId },
    select: { id: true },
  });
  const categoryIds = [category.id, ...children.map((c) => c.id)];

  // ── Budget resolution ─────────────────────────────────────────────────────
  // Constraints win over answers.budget if both present.
  const budget = input.constraints?.maxPrice !== undefined
    ? { min: input.constraints.minPrice ?? 0, max: input.constraints.maxPrice }
    : parseBudget(input.answers.budget);

  const brand =
    input.constraints?.brand?.trim() ??
    input.answers.brand?.trim();

  const budgetCurrency =
    budget && merchantSettings.respectCustomerBudget
      ? await dominantCurrencyForCategory(input.orgId, categoryIds, orgCurrency)
      : null;

  // ── Candidate generation + hard filters ──────────────────────────────────
  const candidates = await prisma.product.findMany({
    where: {
      orgId: input.orgId,
      categoryId: { in: categoryIds },
      ...(merchantSettings.onlyRecommendAvailable
        ? { inventoryStatus: { not: "OUT_OF_STOCK" } }
        : {}),
      // Hard price ceiling — B13: hard constraints always win
      ...(budget && merchantSettings.respectCustomerBudget
        ? {
            price: {
              ...(budget.min ? { gte: budget.min } : {}),
              ...(budget.max !== null ? { lte: budget.max } : {}),
            },
            currency: budgetCurrency!,
          }
        : {}),
      // Brand: exact match
      ...(brand ? { brand: { equals: brand, mode: "insensitive" } } : {}),
    },
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
  });

  if (candidates.length === 0) return [];

  // ── Post-query hard constraint validation ─────────────────────────────────
  // Belt-and-suspenders: reject any candidates that slipped through if
  // Prisma's JSON handling produced unexpected results.
  const hardFiltered = candidates.filter((p) => {
    const priceRaw = Number(p.price);
    if (!passesHardConstraints(priceRaw, p.currency, input.constraints ?? {}, budgetCurrency ?? undefined)) {
      return false;
    }
    return true;
  });

  if (hardFiltered.length === 0) return [];

  // ── Intent summary for vector search ─────────────────────────────────────
  const purposeAnswer =
    input.answers.purpose ||
    input.answers.concern ||
    input.answers.room ||
    input.answers.type ||
    input.answers.skinType ||
    input.constraints?.useCase ||
    input.constraints?.style ||
    "";
  const intentSummary = [
    category.name,
    purposeAnswer,
    input.constraints?.color,
    input.constraints?.brand,
  ]
    .filter(Boolean)
    .join(" ");

  // ── Vector scoring ────────────────────────────────────────────────────────
  let vectorScoreById = new Map<string, number>();
  try {
    const queryEmbedding = await embedText(intentSummary);
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const candidateIds = hardFiltered.map((c) => c.id);

    const rows = await prisma.$queryRaw<Array<{ source_id: string; similarity: number }>>`
      SELECT source_id, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM embeddings
      WHERE org_id = ${input.orgId}::uuid
        AND source_type = 'PRODUCT'
        AND source_id = ANY(${candidateIds}::uuid[])
    `;
    vectorScoreById = new Map(rows.map((r) => [r.source_id, r.similarity]));
  } catch (err) {
    console.error("Recommend: vector scoring failed, using creation-date order.", err);
  }

  // ── Multi-factor ranking (B13) ────────────────────────────────────────────
  const scored = hardFiltered.map((p) => {
    const vectorScore = vectorScoreById.get(p.id) ?? 0;
    const finalScore = computeRankScore(
      {
        id: p.id,
        priceRaw: Number(p.price),
        currency: p.currency,
        inStock: p.inventoryStatus !== "OUT_OF_STOCK",
        createdAt: p.createdAt,
        vectorScore,
      },
      vectorScore,
      input.constraints,
      merchantSettings,
    );
    return { product: p, finalScore };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);

  return scored.slice(0, MAX_RESULTS).map(({ product: p }) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: formatMoney(p.price, p.currency),
    priceRaw: Number(p.price),
    currency: p.currency,
    imageUrl: firstImageUrl(p.images),
    url: safeHttpUrl(p.sourceUrl),
    inStock: p.inventoryStatus !== "OUT_OF_STOCK",
    category: p.category?.name ?? null,
    attributes: (p.attributes ?? {}) as Record<string, unknown>,
  }));
}

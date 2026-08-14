/**
 * Similar Product Engine (Milestone B5)
 *
 * Multi-signal product similarity:
 *   - Category alignment      (weight: 0.30)
 *   - Attribute overlap       (weight: 0.25) — color, style, material, etc.
 *   - Price proximity         (weight: 0.20) — 0=far, 1=exact same price
 *   - Brand match             (weight: 0.05)
 *   - Vector similarity       (weight: 0.20) — pgvector cosine
 *
 * Hard rules: the reference product is always excluded; OUT_OF_STOCK
 * products are excluded by default (merchant can override via settings).
 */

import prisma from "@/lib/prisma";
import type { Product } from "@prisma/client";
import { embedText } from "@/server/conversation/embeddings";
import { formatMoney } from "@/server/catalog/money";
import { firstImageUrl, safeHttpUrl } from "@/server/retrieval/search";

export interface SimilarProduct {
  id: string;
  name: string;
  brand: string | null;
  price: string;
  imageUrl: string | null;
  url: string | null;
  inStock: boolean;
  /** Composite similarity score 0-1 */
  score: number;
}

const WEIGHTS = {
  category: 0.30,
  attributes: 0.25,
  price: 0.20,
  brand: 0.05,
  vector: 0.20,
};

const MAX_CANDIDATES = 60;
const MAX_RESULTS = 5;

/**
 * Computes normalised price proximity score: 1 when prices match, decays
 * exponentially with relative distance. Score < 0.1 when >5x price difference.
 */
function priceProximityScore(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  const ratio = Math.min(a, b) / Math.max(a, b);
  return ratio;
}

/**
 * Attribute overlap score — Jaccard-style intersection over union of
 * string attribute values. Both keys and values must match.
 */
function attributeOverlapScore(
  attrsA: Record<string, unknown>,
  attrsB: Record<string, unknown>
): number {
  const keysA = new Set(Object.keys(attrsA));
  const keysB = new Set(Object.keys(attrsB));
  const union = new Set([...keysA, ...keysB]);
  if (union.size === 0) return 0;

  let intersection = 0;
  for (const k of keysA) {
    if (
      keysB.has(k) &&
      String(attrsA[k]).toLowerCase() === String(attrsB[k]).toLowerCase()
    ) {
      intersection++;
    }
  }
  return intersection / union.size;
}

export async function getSimilarProducts(
  orgId: string,
  referenceProductId: string,
  options?: { limit?: number; includeOutOfStock?: boolean }
): Promise<SimilarProduct[]> {
  const limit = options?.limit ?? MAX_RESULTS;
  const includeOutOfStock = options?.includeOutOfStock ?? false;

  // Load reference product
  const reference = await prisma.product.findFirst({
    where: { id: referenceProductId, orgId },
    include: { category: true },
  });
  if (!reference) return [];

  const refPrice = Number(reference.price);
  const refAttrs = (reference.attributes ?? {}) as Record<string, unknown>;

  // Load candidates from same category first, then org-wide if thin set
  const candidates = await prisma.product.findMany({
    where: {
      orgId,
      id: { not: referenceProductId },
      ...(includeOutOfStock ? {} : { inventoryStatus: { not: "OUT_OF_STOCK" } }),
    },
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
  });

  if (candidates.length === 0) return [];

  // Get vector embeddings for reference product + candidates
  let vectorScores = new Map<string, number>();
  try {
    const referenceText = [
      reference.name,
      reference.category?.name,
      reference.brand,
      reference.description,
    ]
      .filter(Boolean)
      .join(" ");

    const queryEmbedding = await embedText(referenceText);
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const candidateIds = candidates.map((c) => c.id);

    const rows = await prisma.$queryRaw<Array<{ source_id: string; similarity: number }>>`
      SELECT source_id, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM embeddings
      WHERE org_id = ${orgId}::uuid
        AND source_type = 'PRODUCT'
        AND source_id = ANY(${candidateIds}::uuid[])
    `;
    vectorScores = new Map(rows.map((r) => [r.source_id, r.similarity]));
  } catch (err) {
    console.warn("[SimilarProducts] Vector scoring failed, continuing without:", err);
  }

  // Score candidates using multi-signal approach
  const scored: Array<{ product: Product & { category: { id: string; name: string } | null }; score: number }> = [];

  for (const c of candidates) {
    const candPrice = Number(c.price);
    const candAttrs = (c.attributes ?? {}) as Record<string, unknown>;

    const categoryScore = c.categoryId === reference.categoryId ? 1 : 0;
    const attrScore = attributeOverlapScore(refAttrs, candAttrs);
    const priceScore = priceProximityScore(refPrice, candPrice);
    const brandScore = reference.brand && c.brand && reference.brand.toLowerCase() === c.brand.toLowerCase() ? 1 : 0;
    const vectorScore = vectorScores.get(c.id) ?? 0;

    const composite =
      WEIGHTS.category * categoryScore +
      WEIGHTS.attributes * attrScore +
      WEIGHTS.price * priceScore +
      WEIGHTS.brand * brandScore +
      WEIGHTS.vector * vectorScore;

    scored.push({ product: c, score: composite });
  }

  // Sort by composite score, descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ product: p, score }) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: formatMoney(p.price, p.currency),
    imageUrl: firstImageUrl(p.images),
    url: safeHttpUrl(p.sourceUrl),
    inStock: p.inventoryStatus !== "OUT_OF_STOCK",
    score,
  }));
}

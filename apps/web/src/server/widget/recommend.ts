import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { formatMoney } from "@/server/catalog/money";
import { embedText } from "@/server/conversation/embeddings";
import { safeHttpUrl, firstImageUrl } from "@/server/retrieval/search";

const MAX_RESULTS = 5;
const MAX_CANDIDATES = 40; // cap re-ranking cost per call

export interface RecommendedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: string;
  imageUrl: string | null;
  url: string | null;
  inStock: boolean;
}

export interface RecommendInput {
  orgId: string;
  categoryId: string;
  answers: Record<string, string>;
}

/** Budget values are "min-max"; max empty means open-ended above min. */
function parseBudget(value: string | undefined): { min: number; max: number | null } | null {
  if (!value) return null;
  const [minStr, maxStr] = value.split("-");
  const min = Number(minStr);
  if (!Number.isFinite(min)) return null;
  const max = maxStr ? Number(maxStr) : null;
  return { min, max: max !== null && Number.isFinite(max) ? max : null };
}

/**
 * Deterministic filter + relevance rank: (1) filter candidates by
 * category (+ children), budget, and brand; (2) rank the filtered set by
 * embedding relevance to the shopper's stated purpose using the SAME
 * pgvector embeddings already generated for RAG (server/knowledge/sync.ts)
 * — no extra LLM call, no re-embedding candidates on every request.
 */
export async function recommendProducts(input: RecommendInput): Promise<RecommendedProduct[]> {
  const category = await prisma.category.findFirst({ where: { id: input.categoryId, orgId: input.orgId } });
  if (!category) throw new ApiError(404, "Category not found.");

  const children = await prisma.category.findMany({
    where: { parentId: category.id, orgId: input.orgId },
    select: { id: true },
  });
  const categoryIds = [category.id, ...children.map((c) => c.id)];

  const budget = parseBudget(input.answers.budget);
  const brand = input.answers.brand?.trim();

  const candidates = await prisma.product.findMany({
    where: {
      orgId: input.orgId,
      categoryId: { in: categoryIds },
      inventoryStatus: { not: "OUT_OF_STOCK" },
      ...(budget
        ? { price: { gte: budget.min, ...(budget.max !== null ? { lte: budget.max } : {}) } }
        : {}),
      ...(brand ? { brand } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
  });

  if (candidates.length === 0) return [];

  // Rank by relevance to whatever the shopper told us about their purpose
  // (the first non-budget/brand answer collected, e.g. "gaming", "acne").
  const purposeAnswer =
    input.answers.purpose ||
    input.answers.concern ||
    input.answers.room ||
    input.answers.type ||
    input.answers.skinType ||
    "";
  const intentSummary = [category.name, purposeAnswer].filter(Boolean).join(" ");

  let ranked = candidates;
  try {
    const queryEmbedding = await embedText(intentSummary);
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const candidateIds = candidates.map((c) => c.id);

    const similarityRows = await prisma.$queryRaw<Array<{ source_id: string; similarity: number }>>`
      SELECT source_id, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM embeddings
      WHERE org_id = ${input.orgId}::uuid
        AND source_type = 'PRODUCT'
        AND source_id = ANY(${candidateIds}::uuid[])
    `;
    const simById = new Map(similarityRows.map((r) => [r.source_id, r.similarity]));
    ranked = candidates.slice().sort((a, b) => (simById.get(b.id) ?? 0) - (simById.get(a.id) ?? 0));
  } catch (err) {
    // Embedding relevance is an enhancement, not a requirement — a Voyage
    // hiccup degrades to the filtered-but-unranked list rather than failing
    // the whole recommendation.
    console.error("Recommend: relevance ranking failed, falling back to unranked order.", err);
  }

  return ranked.slice(0, MAX_RESULTS).map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: formatMoney(p.price, p.currency),
    imageUrl: firstImageUrl(p.images),
    url: safeHttpUrl(p.sourceUrl),
    inStock: p.inventoryStatus !== "OUT_OF_STOCK",
  }));
}

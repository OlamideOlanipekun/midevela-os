import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { formatMoney } from "@/server/catalog/money";
import { embedText } from "@/server/conversation/embeddings";
import { safeHttpUrl, firstImageUrl } from "@/server/retrieval/search";

const MAX_RESULTS = 5;
const MAX_CANDIDATES = 40;

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

function parseBudget(value: string | undefined): { min: number; max: number | null } | null {
  if (!value) return null;
  const [minStr, maxStr] = value.split("-");
  const min = Number(minStr);
  if (!Number.isFinite(min)) return null;
  const max = maxStr ? Number(maxStr) : null;
  return { min, max: max !== null && Number.isFinite(max) ? max : null };
}

/**
 * Derives the most common (dominant) currency among in-stock products in
 * the given category set. Falls back to the org-level currency when no
 * products explicitly set a currency.
 */
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
    if (count > maxCount) {
      maxCount = count;
      dominant = c;
    }
  }
  return dominant;
}

/**
 * Deterministic filter + relevance rank: (1) filter candidates by
 * category (+ children), budget, and brand; (2) rank the filtered set by
 * embedding relevance to the shopper's stated purpose using pgvector
 * embeddings — no extra LLM call.
 *
 * Currency consistency: when a budget is applied the filter uses the
 * dominant currency among the category's products, NOT the org-level
 * currency, so the budget labels shown to the shopper (computed by
 * computeBudgetOptions) match the currency used for filtering.
 */
export async function recommendProducts(input: RecommendInput): Promise<RecommendedProduct[]> {
  const [category, org] = await Promise.all([
    prisma.category.findFirst({ where: { id: input.categoryId, orgId: input.orgId } }),
    prisma.organization.findUnique({ where: { id: input.orgId }, select: { currency: true } }),
  ]);
  if (!category) throw new ApiError(404, "Category not found.");

  const children = await prisma.category.findMany({
    where: { parentId: category.id, orgId: input.orgId },
    select: { id: true },
  });
  const categoryIds = [category.id, ...children.map((c) => c.id)];

  const orgCurrency = org?.currency ?? "NGN";
  const budget = parseBudget(input.answers.budget);
  const brand = input.answers.brand?.trim();

  // Determine which currency to use for budget filtering — match the
  // dominant product currency used by computeBudgetOptions for the labels.
  const budgetCurrency = budget
    ? await dominantCurrencyForCategory(input.orgId, categoryIds, orgCurrency)
    : null;

  const candidates = await prisma.product.findMany({
    where: {
      orgId: input.orgId,
      categoryId: { in: categoryIds },
      inventoryStatus: { not: "OUT_OF_STOCK" },
      ...(budget
        ? {
            price: { gte: budget.min, ...(budget.max !== null ? { lte: budget.max } : {}) },
            currency: budgetCurrency!,
          }
        : {}),
      ...(brand ? { brand } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
  });

  if (candidates.length === 0) return [];

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

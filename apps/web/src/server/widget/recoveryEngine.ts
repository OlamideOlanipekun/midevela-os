import prisma from "@/lib/prisma";
import { formatMoney } from "@/server/catalog/money";
import { recommendProducts, type RecommendedProduct } from "@/server/widget/recommend";
import { listCategoriesForWidget } from "@/server/catalog/categories";
import { firstImageUrl, safeHttpUrl } from "@/server/retrieval/search";

export interface RecoveryResult {
  replyText: string;
  recommendations: RecommendedProduct[];
  /** Updated budget if recovery relaxed it */
  relaxedBudget?: { min?: number; max?: number };
  /** Updated category if recovery switched */
  relaxedCategoryId?: string;
  relaxedCategoryName?: string;
}

/**
 * When adaptive discovery returns zero results, try to recover by:
 *  1. Removing the budget constraint (find products just above it)
 *  2. Trying sibling/related categories
 *  3. Suggesting popular products in the org as a fallback
 *
 * Returns null if even the broadened search finds nothing — in that case
 * the caller should fall back to a general "I couldn't find anything" LLM
 * response.
 */
export async function tryRecovery(input: {
  orgId: string;
  messageText: string;
  categoryId?: string;
  categoryName?: string;
  budget?: { min?: number; max?: number };
  answers: Record<string, string>;
}): Promise<RecoveryResult | null> {
  const { orgId, categoryId, categoryName, budget, answers } = input;

  // ── Strategy 1: No budget constraint → find above-budget options ──────
  if (budget?.max && categoryId) {
    const relaxedAnswers = { ...answers };
    delete relaxedAnswers.budget;

    const aboveBudget = await prisma.product.findMany({
      where: {
        orgId,
        categoryId,
        inventoryStatus: { not: "OUT_OF_STOCK" },
        price: { gte: budget.max, lte: budget.max * 3 },
      },
      orderBy: { price: "asc" },
      take: 3,
    });

    if (aboveBudget.length > 0) {
      const currency = aboveBudget[0].currency ?? "NGN";
      const formatted = aboveBudget.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        price: formatMoney(p.price, currency),
        priceRaw: Number(p.price),
        currency,
        imageUrl: firstImageUrl(p.images),
        url: safeHttpUrl(p.sourceUrl),
        inStock: p.inventoryStatus !== "OUT_OF_STOCK",
      }));

      const lines = formatted.map(
        (p) => `**${p.name}**${p.brand ? ` by ${p.brand}` : ""} — ${p.price}`,
      );

      return {
        replyText: [
          `I couldn't find anything under ${formatMoney(budget.max, currency)} in ${categoryName || "this category"}.`,
          `Here are some options slightly above your budget:`,
          ``,
          ...lines,
          ``,
          `Would you like to:`,
          `• See details on any of these`,
          `• Increase your budget`,
          `• Try a different category`,
        ].join("\n"),
        recommendations: formatted,
        relaxedBudget: { max: budget.max * 3 },
      };
    }
  }

  // ── Strategy 2: Try sibling categories ────────────────────────────────
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, orgId },
      select: { parentId: true },
    });

    if (category?.parentId) {
      const siblings = await prisma.category.findMany({
        where: { parentId: category.parentId, orgId, id: { not: categoryId } },
        select: { id: true, name: true },
        take: 5,
      });

      if (siblings.length > 0) {
        const lines: string[] = [];
        for (const sibling of siblings) {
          const recs = await recommendProducts({
            orgId,
            categoryId: sibling.id,
            answers,
          });
          if (recs.length > 0) {
            lines.push(`• **${sibling.name}** — ${recs[0].name} (${recs[0].price})`);
          }
        }

        if (lines.length > 0) {
          return {
            replyText: [
              `I couldn't find products matching your criteria in ${categoryName || "that category"}.`,
              `Here are some related categories you might like:`,
              ``,
              ...lines,
              ``,
              `Would you like me to show options from one of these?`,
            ].join("\n"),
            recommendations: [],
          };
        }
      }
    }

    // Strategy 2b: Popular products in the org
    const popular = await prisma.product.findMany({
      where: { orgId, inventoryStatus: { not: "OUT_OF_STOCK" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (popular.length > 0) {
      const currency = popular[0].currency ?? "NGN";
      const formatted = popular.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        price: formatMoney(p.price, currency),
        priceRaw: Number(p.price),
        currency,
        imageUrl: firstImageUrl(p.images),
        url: safeHttpUrl(p.sourceUrl),
        inStock: p.inventoryStatus !== "OUT_OF_STOCK",
      }));

      const lines = formatted.map(
        (p) => `**${p.name}**${p.brand ? ` by ${p.brand}` : ""} — ${p.price}`,
      );

      return {
        replyText: [
          `I couldn't find a match for that in our catalog. Here are some popular products:`,
          ``,
          ...lines,
          ``,
          `Would you like me to help you find something specific?`,
        ].join("\n"),
        recommendations: formatted,
      };
    }
  }

  return null;
}

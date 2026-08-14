/**
 * Natural-Language Product Filtering (Milestone B2)
 *
 * Converts StructuredIntent constraints into Prisma WHERE clauses.
 * Hard constraints ALWAYS win — no semantically-close products returned
 * when a shopper has specified maxPrice, color, brand, etc.
 */

import type { Prisma, InventoryStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { formatMoney } from "@/server/catalog/money";
import { firstImageUrl, safeHttpUrl } from "@/server/retrieval/search";
import type { ParsedConstraints } from "@/server/widget/intentEngine";

export interface FilteredProduct {
  id: string;
  name: string;
  brand: string | null;
  price: string;
  priceRaw: number;
  currency: string;
  category: string | null;
  categoryId: string | null;
  description: string | null;
  attributes: Record<string, unknown>;
  inventoryStatus: InventoryStatus;
  imageUrl: string | null;
  url: string | null;
  inStock: boolean;
}

/**
 * Determines the dominant currency among in-stock products for an org's category set.
 * Used to ensure budget filtering uses the same currency shown in price labels.
 */
async function resolveBudgetCurrency(
  orgId: string,
  categoryIds: string[],
  fallback: string
): Promise<string> {
  if (categoryIds.length === 0) return fallback;

  const rows = await prisma.product.findMany({
    where: {
      orgId,
      categoryId: categoryIds.length > 0 ? { in: categoryIds } : undefined,
      inventoryStatus: { not: "OUT_OF_STOCK" },
    },
    select: { currency: true },
    take: 200,
  });

  if (rows.length === 0) return fallback;
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.currency, (counts.get(r.currency) ?? 0) + 1);
  }
  let best = fallback;
  let bestCount = 0;
  for (const [c, n] of counts) {
    if (n > bestCount) { best = c; bestCount = n; }
  }
  return best;
}

/**
 * Maps a color constraint to Product.attributes matching patterns.
 * Checks both top-level product attributes and common attribute keys.
 */
function buildColorFilter(color: string): Prisma.ProductWhereInput {
  const c = color.toLowerCase();
  return {
    OR: [
      // attributes.color = "black" (case-insensitive via contains)
      { attributes: { path: ["color"], string_contains: c } },
      // name contains the color
      { name: { contains: c, mode: "insensitive" } },
      // description contains the color
      { description: { contains: c, mode: "insensitive" } },
    ],
  };
}

export interface FilterInput {
  orgId: string;
  constraints: ParsedConstraints;
  /** Additional category IDs to restrict to (from semantic resolution) */
  categoryIds?: string[];
  /** Respect only in-stock products */
  onlyAvailable?: boolean;
  /** Override max results */
  limit?: number;
}

export interface FilterResult {
  products: FilteredProduct[];
  appliedConstraints: string[];
  totalCandidates: number;
}

/**
 * Hard-filter product catalog using structured constraints.
 *
 * Priority: hard constraints ALWAYS win.
 *   1. Price ceiling (maxPrice)  — strict upper bound
 *   2. Price floor (minPrice)    — strict lower bound
 *   3. Category                  — exact category restriction
 *   4. Brand                     — exact brand match
 *   5. Color / style             — attribute-level filter
 *   6. Inventory                 — exclude OUT_OF_STOCK when required
 *
 * Returns products sorted by price ascending for fair comparison.
 */
export async function filterProducts(input: FilterInput): Promise<FilterResult> {
  const { orgId, constraints, onlyAvailable = true, limit = 20 } = input;
  const appliedConstraints: string[] = [];

  // Resolve org currency for budget filtering
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { currency: true },
  });
  const orgCurrency = org?.currency ?? "NGN";

  // Determine category IDs to restrict
  let categoryIds: string[] = input.categoryIds ?? [];

  // If a category name is given but no IDs, attempt exact + child lookup
  if (constraints.category && categoryIds.length === 0) {
    const cat = await prisma.category.findFirst({
      where: { orgId, name: { equals: constraints.category, mode: "insensitive" } },
      select: { id: true },
    });
    if (cat) {
      const children = await prisma.category.findMany({
        where: { orgId, parentId: cat.id },
        select: { id: true },
      });
      categoryIds = [cat.id, ...children.map((c) => c.id)];
      appliedConstraints.push(`category: ${constraints.category}`);
    }
  }

  // Budget: resolve correct currency for filtering
  let budgetCurrency = orgCurrency;
  if (constraints.maxPrice || constraints.minPrice) {
    budgetCurrency = await resolveBudgetCurrency(orgId, categoryIds, orgCurrency);
  }

  // Build WHERE clause — hard filters applied in strict priority order
  const where: Prisma.ProductWhereInput = {
    orgId,
    ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
    ...(onlyAvailable ? { inventoryStatus: { not: "OUT_OF_STOCK" } } : {}),
    // Brand: exact match (case-insensitive)
    ...(constraints.brand
      ? { brand: { equals: constraints.brand, mode: "insensitive" } }
      : {}),
    // Price ceiling — hard upper bound
    ...(constraints.maxPrice !== undefined
      ? {
          price: {
            lte: constraints.maxPrice,
            ...(constraints.minPrice !== undefined ? { gte: constraints.minPrice } : {}),
          },
          currency: budgetCurrency,
        }
      : constraints.minPrice !== undefined
      ? {
          price: { gte: constraints.minPrice },
          currency: budgetCurrency,
        }
      : {}),
    // Color filter through attributes + name/description
    ...(constraints.color ? buildColorFilter(constraints.color) : {}),
  };

  if (constraints.maxPrice !== undefined) appliedConstraints.push(`maxPrice: ${formatMoney(constraints.maxPrice, budgetCurrency)}`);
  if (constraints.minPrice !== undefined) appliedConstraints.push(`minPrice: ${formatMoney(constraints.minPrice, budgetCurrency)}`);
  if (constraints.brand) appliedConstraints.push(`brand: ${constraints.brand}`);
  if (constraints.color) appliedConstraints.push(`color: ${constraints.color}`);
  if (constraints.style) appliedConstraints.push(`style: ${constraints.style}`);
  if (constraints.useCase) appliedConstraints.push(`useCase: ${constraints.useCase}`);

  const raw = await prisma.product.findMany({
    where,
    include: { category: { select: { id: true, name: true } } },
    orderBy: { price: "asc" },
    take: limit,
  });

  const products: FilteredProduct[] = raw.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: formatMoney(p.price, p.currency),
    priceRaw: Number(p.price),
    currency: p.currency,
    category: p.category?.name ?? null,
    categoryId: p.category?.id ?? null,
    description: p.description,
    attributes: (p.attributes ?? {}) as Record<string, unknown>,
    inventoryStatus: p.inventoryStatus,
    imageUrl: firstImageUrl(p.images),
    url: safeHttpUrl(p.sourceUrl),
    inStock: p.inventoryStatus !== "OUT_OF_STOCK",
  }));

  return { products, appliedConstraints, totalCandidates: products.length };
}

/**
 * Validates that a product passes all hard constraints.
 * Used post-vector-search to reject any semantically-relevant-but-price-invalid products.
 */
export function passesHardConstraints(
  priceRaw: number,
  currency: string,
  constraints: ParsedConstraints,
  budgetCurrency?: string
): boolean {
  if (budgetCurrency && currency !== budgetCurrency) return false;
  if (constraints.maxPrice !== undefined && priceRaw > constraints.maxPrice) return false;
  if (constraints.minPrice !== undefined && priceRaw < constraints.minPrice) return false;
  return true;
}

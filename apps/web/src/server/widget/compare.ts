/**
 * Product Comparison Engine (Milestone B6)
 *
 * Generates structured, side-by-side comparisons grounded exclusively
 * in merchant database fields (Product.attributes, price, brand, etc.).
 *
 * Rules:
 *  - If the store doesn't provide a specification: "The website doesn't provide this information"
 *  - Never invent product specs from model knowledge
 *  - The LLM only generates the "which to pick" judgment, not the spec rows
 */

import prisma from "@/lib/prisma";
import type { Product } from "@prisma/client";
import { ApiError } from "@/server/http";
import { formatMoney } from "@/server/catalog/money";
import { completeJson, type ChatMessage } from "@/server/conversation/llm";

export interface CompareRow {
  label: string;
  /** Same order as CompareResult.products. */
  values: string[];
  /** True when the attribute is missing for ALL products in the set */
  allMissing?: boolean;
}

export interface CompareResult {
  products: Array<{ id: string; name: string; price: string; brand: string | null }>;
  rows: CompareRow[];
  recommendation: string;
  /** Whether the comparison had enough data to be meaningful */
  hasEnoughData: boolean;
}

const MISSING = "The website doesn't provide this information";

/**
 * Build real, trusted spec rows from Product.attributes.
 * Returns a row only when at least one product has a value.
 * Uses MISSING sentinel for products without that attribute.
 */
function attributeRows(products: Product[]): CompareRow[] {
  // Collect all attribute keys across all products
  const keys = new Set<string>();
  for (const p of products) {
    const attrs = p.attributes;
    if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
      for (const k of Object.keys(attrs as Record<string, unknown>)) {
        keys.add(k);
      }
    }
  }

  const rows: CompareRow[] = [];
  for (const key of keys) {
    const values = products.map((p) => {
      const attrs = (p.attributes ?? {}) as Record<string, unknown>;
      const v = attrs[key];
      return v === undefined || v === null || v === "" ? MISSING : String(v);
    });
    // Only include a row when at least one product has a real value
    const allMissing = values.every((v) => v === MISSING);
    if (!allMissing) {
      rows.push({ label: key, values, allMissing: false });
    }
  }
  return rows;
}

/**
 * Core verified fields always shown: price, availability, brand, category.
 * These never display MISSING — they use human-readable fallbacks from real DB fields.
 */
function coreRows(ordered: Product[], categories: Map<string, string>): CompareRow[] {
  const rows: CompareRow[] = [];

  // Price — always available
  rows.push({
    label: "Price",
    values: ordered.map((p) => formatMoney(p.price, p.currency)),
  });

  // Availability — always available
  rows.push({
    label: "Availability",
    values: ordered.map((p) =>
      p.inventoryStatus === "IN_STOCK"
        ? "In stock"
        : p.inventoryStatus === "LOW_STOCK"
        ? "Low stock"
        : "Out of stock"
    ),
  });

  // Brand — show MISSING if not present
  const brands = ordered.map((p) => p.brand ?? MISSING);
  rows.push({ label: "Brand", values: brands, allMissing: brands.every((b) => b === MISSING) });

  // Category
  const cats = ordered.map((p) => (p.categoryId ? categories.get(p.categoryId) ?? MISSING : MISSING));
  rows.push({ label: "Category", values: cats, allMissing: cats.every((c) => c === MISSING) });

  return rows;
}

/**
 * Generate a factual "which to pick" judgment using the LLM.
 * The model only sees the rows already pulled from the DB — it cannot
 * add specifications that don't exist in the data.
 */
async function generateRecommendation(
  products: Product[],
  rows: CompareRow[],
  shopperUseCase?: string
): Promise<string> {
  const usefulRows = rows.filter((r) => !r.allMissing);
  if (usefulRows.length <= 2) {
    return "We don't have enough detail from the store to recommend one over the other. Compare the specs above against what matters most to you.";
  }

  const table = usefulRows
    .map((r) =>
      `${r.label}: ${products.map((p, i) => `${p.name}=${r.values[i]}`).join(" | ")}`
    )
    .join("\n");

  const systemPrompt = `You are a shopping assistant. 
Given the verified product comparison table below (sourced from merchant data), recommend which product to pick and briefly explain why.
IMPORTANT: Only cite information present in the comparison table. If you need to mention something that isn't in the table, say "The website doesn't provide this information".
${shopperUseCase ? `The shopper mentioned their use case: "${shopperUseCase}".` : ""}
Respond with ONLY JSON: {"recommendation": string}
2-3 concise sentences.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Products: ${products.map((p) => p.name).join(" vs ")}\n\n${table}`,
    },
  ];

  try {
    const res = await completeJson(messages);
    const parsed = JSON.parse(res.raw);
    if (typeof parsed?.recommendation === "string" && parsed.recommendation.trim()) {
      return parsed.recommendation.trim();
    }
  } catch (err) {
    console.error("[Compare] recommendation LLM call failed:", err);
  }

  return "Both are solid options — compare the specs above against what matters most to you.";
}

/**
 * Compare up to 3 products side by side.
 * Strictly grounded in merchant data.
 */
export async function compareProducts(
  orgId: string,
  productIds: string[],
  options?: { shopperUseCase?: string }
): Promise<CompareResult> {
  const uniqueIds = [...new Set(productIds)].slice(0, 3);
  if (uniqueIds.length < 2) throw new ApiError(400, "Two or more distinct productIds are required.");

  const products = await prisma.product.findMany({
    where: { id: { in: uniqueIds }, orgId },
    include: { category: { select: { id: true, name: true } } },
  });

  if (products.length < 2) throw new ApiError(404, "One or more products were not found.");

  // Preserve input order
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = uniqueIds
    .map((id) => byId.get(id))
    .filter((p): p is (typeof products)[number] => Boolean(p));

  const categoryMap = new Map(
    ordered.map((p) => [p.category?.id ?? "", p.category?.name ?? ""])
  );

  const rows: CompareRow[] = [
    ...coreRows(ordered, categoryMap),
    ...attributeRows(ordered),
  ];

  const hasEnoughData = rows.filter((r) => !r.allMissing).length > 2;

  const recommendation = await generateRecommendation(
    ordered,
    rows,
    options?.shopperUseCase
  );

  return {
    products: ordered.map((p) => ({
      id: p.id,
      name: p.name,
      price: formatMoney(p.price, p.currency),
      brand: p.brand,
    })),
    rows,
    recommendation,
    hasEnoughData,
  };
}

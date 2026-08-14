/**
 * Variant Intelligence Engine (Milestone B10)
 *
 * Answers shopper questions like:
 *   "Do you have this in size 42?"
 *   "Is this available in black?"
 *   "What sizes come in?"
 *
 * Queries ProductVariant table by product ID + attribute filters.
 * Never fabricates availability — all answers are grounded in DB records.
 */

import prisma from "@/lib/prisma";
import { formatMoney } from "@/server/catalog/money";

export interface VariantAvailabilityResult {
  found: boolean;
  /** The specific variant matched, if any */
  matchedVariant?: {
    id: string;
    name: string | null;
    sku: string | null;
    attributes: Record<string, string>;
    inventoryStatus: string;
    inventoryQuantity: number | null;
    price: string | null;
  };
  /** All available variants for the product (for "what sizes do you have?") */
  availableVariants?: Array<{
    id: string;
    name: string | null;
    attributes: Record<string, string>;
    inventoryStatus: string;
    price: string | null;
  }>;
  /** Human-readable answer for the widget */
  answer: string;
}

export interface VariantQuery {
  size?: string;
  color?: string;
  attributeKey?: string;
  attributeValue?: string;
}

/**
 * Normalise a size value for case-insensitive comparison.
 * "42" → "42", "XL" → "xl", "Extra Large" → "extra large"
 */
function normaliseSize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Check whether a variant's attributes JSON matches the query.
 * All query fields must match (AND logic). String comparisons are case-insensitive.
 */
function variantMatchesQuery(
  attrs: Record<string, unknown>,
  query: VariantQuery
): boolean {
  const attrsLower: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    attrsLower[k.toLowerCase()] = String(v).toLowerCase();
  }

  if (query.size) {
    const target = normaliseSize(query.size);
    const sizeValue = attrsLower["size"] ?? attrsLower["shoe_size"] ?? attrsLower["size_eu"] ?? "";
    if (!sizeValue.includes(target)) return false;
  }

  if (query.color) {
    const target = query.color.toLowerCase();
    const colorValue = attrsLower["color"] ?? attrsLower["colour"] ?? "";
    if (!colorValue.includes(target)) return false;
  }

  if (query.attributeKey && query.attributeValue) {
    const keyLower = query.attributeKey.toLowerCase();
    const valueLower = query.attributeValue.toLowerCase();
    if (!(attrsLower[keyLower] ?? "").includes(valueLower)) return false;
  }

  return true;
}

/**
 * Check variant availability for a specific product.
 * Returns a human-readable answer grounded strictly in DB records.
 */
export async function checkVariantAvailability(
  orgId: string,
  productId: string,
  query: VariantQuery
): Promise<VariantAvailabilityResult> {
  // Load all variants for this product
  const variants = await prisma.productVariant.findMany({
    where: { productId, orgId },
    orderBy: { createdAt: "asc" },
  });

  // Also load the parent product for context
  const product = await prisma.product.findFirst({
    where: { id: productId, orgId },
    select: { name: true, inventoryStatus: true },
  });

  // No variants in database — fall back to parent product stock info
  if (variants.length === 0) {
    // If parent product itself is in stock and query has no specific attrs, it counts
    if (product && product.inventoryStatus !== "OUT_OF_STOCK") {
      const queryDescription = buildQueryDescription(query);
      if (!queryDescription) {
        return {
          found: true,
          answer: `Yes, this product is currently in stock.`,
        };
      }
      // We have no variant data but the product is available
      return {
        found: false,
        answer: `This product is listed as available, but the website doesn't provide specific variant information (${queryDescription}).`,
      };
    }
    return {
      found: false,
      answer: product
        ? `This product is currently out of stock.`
        : `The website doesn't provide variant information for this product.`,
    };
  }

  // Find matching variants
  const matching = variants.filter((v) => {
    const attrs = (v.attributes ?? {}) as Record<string, unknown>;
    return variantMatchesQuery(attrs, query);
  });

  const queryDescription = buildQueryDescription(query);

  if (matching.length === 0) {
    // List what IS available for this product
    const availableSizes = extractAttributeValues(variants, "size");
    const availableColors = extractAttributeValues(variants, "color");

    let hint = "";
    if (availableSizes.length > 0) hint += ` Available sizes: ${availableSizes.join(", ")}.`;
    if (availableColors.length > 0) hint += ` Available colours: ${availableColors.join(", ")}.`;

    return {
      found: false,
      availableVariants: variants.map((v) => ({
        id: v.id,
        name: v.name,
        attributes: (v.attributes ?? {}) as Record<string, string>,
        inventoryStatus: v.inventoryStatus,
        price: v.price ? formatMoney(v.price, v.currency) : null,
      })),
      answer: `I couldn't find ${queryDescription} for this product.${hint}`,
    };
  }

  const inStock = matching.filter((v) => v.inventoryStatus !== "OUT_OF_STOCK");
  const bestMatch = inStock[0] ?? matching[0];
  const attrs = (bestMatch.attributes ?? {}) as Record<string, string>;

  if (inStock.length > 0) {
    const quantityNote =
      bestMatch.inventoryQuantity !== null
        ? ` (${bestMatch.inventoryQuantity} units available)`
        : "";
    return {
      found: true,
      matchedVariant: {
        id: bestMatch.id,
        name: bestMatch.name,
        sku: bestMatch.sku,
        attributes: attrs,
        inventoryStatus: bestMatch.inventoryStatus,
        inventoryQuantity: bestMatch.inventoryQuantity,
        price: bestMatch.price ? formatMoney(bestMatch.price, bestMatch.currency) : null,
      },
      answer: `Yes, ${queryDescription} is listed as available${quantityNote}.${bestMatch.price ? ` It is priced at ${formatMoney(bestMatch.price, bestMatch.currency)}.` : ""}`,
    };
  }

  return {
    found: false,
    matchedVariant: {
      id: bestMatch.id,
      name: bestMatch.name,
      sku: bestMatch.sku,
      attributes: attrs,
      inventoryStatus: bestMatch.inventoryStatus,
      inventoryQuantity: bestMatch.inventoryQuantity,
      price: bestMatch.price ? formatMoney(bestMatch.price, bestMatch.currency) : null,
    },
    answer: `${queryDescription ? `${queryDescription} exists` : "This variant"} but is currently out of stock.`,
  };
}

/**
 * List all available variants for a product (e.g. "What sizes do you have?")
 */
export async function listProductVariants(
  orgId: string,
  productId: string
): Promise<VariantAvailabilityResult> {
  const variants = await prisma.productVariant.findMany({
    where: { productId, orgId, inventoryStatus: { not: "OUT_OF_STOCK" } },
    orderBy: { createdAt: "asc" },
  });

  if (variants.length === 0) {
    return {
      found: false,
      answer: "The website doesn't list specific variants for this product.",
    };
  }

  const sizes = extractAttributeValues(variants, "size");
  const colors = extractAttributeValues(variants, "color");

  let answer = "Available options:";
  if (sizes.length > 0) answer += ` Sizes — ${sizes.join(", ")}.`;
  if (colors.length > 0) answer += ` Colours — ${colors.join(", ")}.`;
  if (sizes.length === 0 && colors.length === 0) {
    answer = `${variants.length} variant(s) are available. Ask me for details on a specific option.`;
  }

  return {
    found: true,
    availableVariants: variants.map((v) => ({
      id: v.id,
      name: v.name,
      attributes: (v.attributes ?? {}) as Record<string, string>,
      inventoryStatus: v.inventoryStatus,
      price: v.price ? formatMoney(v.price, v.currency) : null,
    })),
    answer,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildQueryDescription(query: VariantQuery): string {
  const parts: string[] = [];
  if (query.size) parts.push(`size ${query.size}`);
  if (query.color) parts.push(query.color);
  if (query.attributeKey && query.attributeValue)
    parts.push(`${query.attributeKey}: ${query.attributeValue}`);
  return parts.join(" / ");
}

function extractAttributeValues(
  variants: Array<{ attributes: unknown }>,
  key: string
): string[] {
  const values = new Set<string>();
  for (const v of variants) {
    const attrs = (v.attributes ?? {}) as Record<string, unknown>;
    // Try key as-is and lowercase
    const val = attrs[key] ?? attrs[key.toLowerCase()];
    if (val !== undefined && val !== null && String(val).trim()) {
      values.add(String(val).trim());
    }
  }
  return Array.from(values);
}

// ── Milestone C: Variant Resolution for Commerce ─────────────────────────────

export interface VariantSelection {
  size?: string;
  color?: string;
  attributes?: Record<string, string>;
}

export interface VariantResolutionResult {
  resolved: boolean;
  variant?: {
    id: string;
    name?: string | null;
    sku?: string | null;
    attributes?: Record<string, unknown>;
    inventoryStatus?: string;
    inventoryQuantity?: number | null;
    price?: string | null;
  };
  message?: string;
}

/**
 * Resolve a specific variant given a product ID, org ID, and variant selections.
 */
export async function resolveVariant(
  productId: string,
  orgId: string,
  selection: VariantSelection
): Promise<VariantResolutionResult> {
  const query: VariantQuery = {
    size: selection.size,
    color: selection.color,
  };

  const variants = await prisma.productVariant.findMany({
    where: { productId, orgId },
  });

  if (variants.length === 0) {
    return {
      resolved: false,
      message: "No variants found for this product",
    };
  }

  // Filter matching candidates
  const matching = variants.filter((v) => {
    const attrs = (v.attributes ?? {}) as Record<string, unknown>;
    if (!variantMatchesQuery(attrs, query)) return false;

    if (selection.attributes) {
      for (const [k, val] of Object.entries(selection.attributes)) {
        if (!val) continue;
        const matchesAttr = variantMatchesQuery(attrs, { attributeKey: k, attributeValue: val });
        if (!matchesAttr) return false;
      }
    }
    return true;
  });

  if (matching.length === 0) {
    return {
      resolved: false,
      message: "Requested variant option does not exist for this product",
    };
  }

  const inStock = matching.find((v) => v.inventoryStatus !== "OUT_OF_STOCK") ?? matching[0];
  if (inStock.inventoryStatus === "OUT_OF_STOCK") {
    return {
      resolved: false,
      message: "Requested variant is currently out of stock",
    };
  }

  return {
    resolved: true,
    variant: {
      id: inStock.id,
      name: inStock.name,
      sku: inStock.sku,
      attributes: (inStock.attributes ?? {}) as Record<string, unknown>,
      inventoryStatus: inStock.inventoryStatus,
      inventoryQuantity: inStock.inventoryQuantity,
      price: inStock.price ? inStock.price.toString() : null,
    },
  };
}


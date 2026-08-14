/**
 * Explainable Recommendations (Milestone B8)
 *
 * Every recommendation comes with a fact-grounded reason:
 *   "I recommend Product B because it is within your ₦100k budget,
 *    matches the black/casual preference you gave me, and is currently in stock."
 *
 * Reasons are generated from verified product attributes and conversation
 * constraints — never from hallucinated product expertise.
 */

import type { ParsedConstraints } from "@/server/widget/intentEngine";
import type { RecommendedProduct } from "@/server/widget/recommend";

export interface ExplainedRecommendation {
  product: RecommendedProduct;
  explanation: string;
}

interface ProductForExplain {
  id: string;
  name: string;
  brand: string | null;
  priceRaw: number;
  currency: string;
  price: string;
  inStock: boolean;
  category?: string | null;
  attributes?: Record<string, unknown>;
}

/**
 * Generate a concise, factual explanation for why a product was recommended.
 * Uses only hard, verified facts from the product record and shopper constraints.
 */
export function explainRecommendation(
  product: ProductForExplain,
  constraints: ParsedConstraints,
  context?: {
    categoryName?: string;
    useCase?: string;
    knownInformation?: Record<string, string>;
  }
): string {
  const reasons: string[] = [];

  // 1. Budget match
  if (constraints.maxPrice !== undefined && product.priceRaw <= constraints.maxPrice) {
    reasons.push(`is within your ${product.currency} ${constraints.maxPrice.toLocaleString()} budget (priced at ${product.price})`);
  }

  // 2. Brand match
  if (constraints.brand && product.brand?.toLowerCase() === constraints.brand.toLowerCase()) {
    reasons.push(`is from your preferred brand (${product.brand})`);
  }

  // 3. Color match (from attributes or name)
  if (constraints.color) {
    const nameIncludesColor = product.name.toLowerCase().includes(constraints.color.toLowerCase());
    const attrColor = String((product.attributes ?? {})["color"] ?? "").toLowerCase();
    if (nameIncludesColor || attrColor.includes(constraints.color.toLowerCase())) {
      reasons.push(`matches your ${constraints.color} colour preference`);
    }
  }

  // 4. Style/use-case match
  if (constraints.style) {
    const attrStyle = String((product.attributes ?? {})["style"] ?? "").toLowerCase();
    if (
      attrStyle.includes(constraints.style.toLowerCase()) ||
      product.name.toLowerCase().includes(constraints.style.toLowerCase())
    ) {
      reasons.push(`suits a ${constraints.style} style`);
    }
  }

  if (constraints.useCase || context?.useCase) {
    const uc = (constraints.useCase ?? context?.useCase) as string;
    reasons.push(`is suitable for ${uc} use`);
  }

  // 5. Category match
  if (context?.categoryName && product.category) {
    if (product.category.toLowerCase().includes(context.categoryName.toLowerCase())) {
      reasons.push(`is in the ${product.category} category you're browsing`);
    }
  }

  // 6. Availability
  if (product.inStock) {
    reasons.push("is currently listed as available");
  }

  // 7. Known information from shopper answers
  if (context?.knownInformation) {
    for (const [key, value] of Object.entries(context.knownInformation)) {
      if (key === "purpose" || key === "use" || key === "concern") {
        reasons.push(`matches your stated ${key} of "${value}"`);
      }
    }
  }

  if (reasons.length === 0) {
    return `${product.name} is a strong match for what you're looking for.`;
  }

  if (reasons.length === 1) {
    return `${product.name} is recommended because it ${reasons[0]}.`;
  }

  const last = reasons.pop()!;
  return `${product.name} is recommended because it ${reasons.join(", ")} and ${last}.`;
}

/**
 * Attach explanations to a list of recommended products.
 */
export function explainRecommendations(
  products: Array<RecommendedProduct & { priceRaw?: number; currency?: string; category?: string | null; attributes?: Record<string, unknown> }>,
  constraints: ParsedConstraints,
  context?: {
    categoryName?: string;
    useCase?: string;
    knownInformation?: Record<string, string>;
  }
): ExplainedRecommendation[] {
  return products.map((p) => ({
    product: p,
    explanation: explainRecommendation(
      {
        id: p.id,
        name: p.name,
        brand: p.brand,
        priceRaw: p.priceRaw ?? 0,
        currency: p.currency ?? "NGN",
        price: p.price,
        inStock: p.inStock,
        category: p.category,
        attributes: p.attributes,
      },
      constraints,
      context
    ),
  }));
}

/**
 * Build a human-readable summary of search constraints applied,
 * for display in the assistant's reply (B2 transparency).
 */
export function summariseConstraints(constraints: ParsedConstraints): string {
  const parts: string[] = [];
  if (constraints.category) parts.push(constraints.category);
  if (constraints.color) parts.push(constraints.color);
  if (constraints.style) parts.push(constraints.style);
  if (constraints.maxPrice !== undefined) parts.push(`under ₦${constraints.maxPrice.toLocaleString()}`);
  if (constraints.minPrice !== undefined) parts.push(`from ₦${constraints.minPrice.toLocaleString()}`);
  if (constraints.brand) parts.push(constraints.brand);
  if (constraints.useCase) parts.push(`for ${constraints.useCase}`);
  return parts.join(", ");
}

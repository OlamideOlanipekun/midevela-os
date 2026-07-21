/**
 * Resolves natural-language product references (e.g. "the first one",
 * "the serum", "Radiance Vitamin C Serum") to concrete product IDs
 * from a list of known recommended products.
 *
 * No LLM required — pure pattern matching.
 */

export interface ResolvedReference {
  productId: string;
  productName: string;
  index: number;
}

type ProductSummary = { id: string; name: string };

/**
 * Try to resolve a user's reference to one of the known products.
 * Returns null when no confident match is found.
 */
export function resolveProductReference(
  message: string,
  recommendedProducts: ProductSummary[],
): ResolvedReference | null {
  if (recommendedProducts.length === 0) return null;

  const lower = message.toLowerCase().trim();

  // ── Ordinal references: "first one" / "the first" / "1st" / "#1" / etc.
  const ordinalPatterns = [
    /\b(?:the\s+)?first(?:\s+one)?\b/i,
    /\b(?:the\s+)?second(?:\s+one)?\b/i,
    /\b(?:the\s+)?third(?:\s+one)?\b/i,
    /\b1st\b/, /\b2nd\b/, /\b3rd\b/,
    /\b#?1\b(?![.\d])/, /\b#?2\b(?![.\d])/, /\b#?3\b(?![.\d])/,
  ];

  for (let i = 0; i < ordinalPatterns.length; i++) {
    if (ordinalPatterns[i].test(lower) && i < recommendedProducts.length) {
      const idx = Math.min(i, recommendedProducts.length - 1);
      return {
        productId: recommendedProducts[idx].id,
        productName: recommendedProducts[idx].name,
        index: idx,
      };
    }
  }

  // ── Number-only or "#N" references: "1", "#2", "number 3"
  const standaloneNumber = lower.match(/^(?:#?(\d+)|number\s+(\d+))$/);
  if (standaloneNumber) {
    const num = parseInt(standaloneNumber[1] ?? standaloneNumber[2], 10);
    const idx = num - 1;
    if (idx >= 0 && idx < recommendedProducts.length) {
      return {
        productId: recommendedProducts[idx].id,
        productName: recommendedProducts[idx].name,
        index: idx,
      };
    }
  }

  // ── Ordinal at end: "the moisturizer" / "pick the serum" / "the second"
  const namedOrdinal = lower.match(
    /\b(the\s+)?(first|second|third|last)\s+(one|item|product|option)?\s*$/i,
  );
  if (namedOrdinal) {
    const rank = namedOrdinal[2].toLowerCase();
    const idx = rank === "first" ? 0 : rank === "second" ? 1 : rank === "third" ? 2 : recommendedProducts.length - 1;
    if (idx < recommendedProducts.length) {
      return {
        productId: recommendedProducts[idx].id,
        productName: recommendedProducts[idx].name,
        index: idx,
      };
    }
  }

  // ── "last one" → the last product
  if (/\b(?:the\s+)?last\s+(?:one|item|product|option)?\s*$/i.test(lower)) {
    const lastIdx = recommendedProducts.length - 1;
    return {
      productId: recommendedProducts[lastIdx].id,
      productName: recommendedProducts[lastIdx].name,
      index: lastIdx,
    };
  }

  // ── Name match: check if any product name appears in the message
  //     Score by longest match to avoid "Serum" matching when "Moisturizer"
  //     is also mentioned.
  let bestMatch: { product: ProductSummary; index: number } | null = null;
  let bestLen = 0;

  for (let i = 0; i < recommendedProducts.length; i++) {
    const name = recommendedProducts[i].name.toLowerCase();
    if (lower.includes(name) && name.length > bestLen) {
      bestLen = name.length;
      bestMatch = { product: recommendedProducts[i], index: i };
    }
  }

  if (bestMatch && bestLen >= 3) {
    return {
      productId: bestMatch.product.id,
      productName: bestMatch.product.name,
      index: bestMatch.index,
    };
  }

  // ── Word-level match: split message into words and check each product
  //     name's words. This handles partials like "vitamin c" → "Radiance
  //     Vitamin C Serum" even when the full name isn't typed.
  const msgWords = lower.split(/\s+/).filter((w) => w.length > 2);

  let bestWordMatch: { product: ProductSummary; index: number; score: number } | null = null;

  for (let i = 0; i < recommendedProducts.length; i++) {
    const nameLower = recommendedProducts[i].name.toLowerCase();
    let score = 0;
    for (const word of msgWords) {
      if (nameLower.includes(word)) score += word.length;
    }
    if (score > (bestWordMatch?.score ?? 0) && score >= 3) {
      bestWordMatch = { product: recommendedProducts[i], index: i, score };
    }
  }

  if (bestWordMatch) {
    return {
      productId: bestWordMatch.product.id,
      productName: bestWordMatch.product.name,
      index: bestWordMatch.index,
    };
  }

  return null;
}

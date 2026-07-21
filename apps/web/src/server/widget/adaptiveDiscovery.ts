import { completeJson } from "@/server/conversation/llm";
import { recommendProducts, type RecommendedProduct } from "@/server/widget/recommend";
import { listCategoriesForWidget } from "@/server/catalog/categories";
import type { ShoppingContext } from "@/server/conversation/engine";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ExtractedRequirements {
  /** Whether the message looks like a product search request */
  hasShoppingIntent: boolean;
  categoryName: string | null;
  budget: { min: number | null; max: number | null } | null;
  brand: string | null;
  purpose: string | null;
  /** Additional attributes like skin type, concern, room, etc. */
  attributes: Record<string, string>;
}

export interface AdaptiveResult {
  /** Final reply text to show the shopper */
  replyText: string;
  /** Product recommendations, if any */
  recommendations: RecommendedProduct[];
  /** Whether the result came from deterministic product search */
  fromEngine: boolean;
  /** The updated shopping context after merging extracted requirements */
  shoppingContext: ShoppingContext;
}

// ── Extraction prompt ──────────────────────────────────────────────────────

function buildExtractionPrompt(messageText: string, existingContext: ShoppingContext | null): string {
  const knownParts: string[] = [];
  if (existingContext?.categoryName) knownParts.push(`- Already knows category: "${existingContext.categoryName}"`);
  if (existingContext?.budget) knownParts.push(`- Already knows budget: "${existingContext.budget}"`);
  if (existingContext?.brand) knownParts.push(`- Already knows preferred brand: "${existingContext.brand}"`);
  if (existingContext?.answers) {
    for (const [k, v] of Object.entries(existingContext.answers)) {
      if (v) knownParts.push(`- Already knows ${k}: "${v}"`);
    }
  }

  const knownBlock = knownParts.length > 0
    ? `The shopper has already provided this information through the widget:\n${knownParts.join("\n")}\n\nDo NOT re-extract requirements they already provided. Only extract NEW information from their current message.`
    : "The shopper hasn't provided any shopping requirements yet.";

  return [
    knownBlock,
    "",
    `Current message from shopper: "${messageText}"`,
    "",
    `Extract any NEW shopping requirements from the current message only. Respond with ONLY JSON:`,
    `{`,
    `  "hasShoppingIntent": boolean,`,
    `  "categoryName": string | null,`,
    `  "budget": { "min": number | null, "max": number | null } | null,`,
    `  "brand": string | null,`,
    `  "purpose": string | null,`,
    `  "attributes": {}`,
    `}`,
    `hasShoppingIntent is true when the shopper is looking for a product to buy or asking for recommendations.`,
    `categoryName should match an actual product category from the store.`,
    `budget should use numeric values (not formatted currency strings).`,
    `attributes holds any other product requirements mentioned (skinType, concern, material, size, etc.).`,
  ].join("\n");
}

// ── Extraction call ────────────────────────────────────────────────────────

async function extractFromMessage(
  messageText: string,
  existingContext: ShoppingContext | null,
): Promise<ExtractedRequirements> {
  const messages = [
    { role: "system" as const, content: buildExtractionPrompt(messageText, existingContext) },
  ];

  const result = await completeJson(messages);
  const parsed = tryParseJson(result.raw);

  if (!parsed || typeof parsed.hasShoppingIntent !== "boolean") {
    return {
      hasShoppingIntent: false,
      categoryName: null,
      budget: null,
      brand: null,
      purpose: null,
      attributes: {},
    };
  }

  return {
    hasShoppingIntent: parsed.hasShoppingIntent,
    categoryName: typeof parsed.categoryName === "string" && parsed.categoryName.trim()
      ? parsed.categoryName.trim() : null,
    budget: isValidBudget(parsed.budget) ? parsed.budget : null,
    brand: typeof parsed.brand === "string" && parsed.brand.trim() ? parsed.brand.trim() : null,
    purpose: typeof parsed.purpose === "string" && parsed.purpose.trim() ? parsed.purpose.trim() : null,
    attributes: typeof parsed.attributes === "object" && parsed.attributes !== null
      ? parsed.attributes as Record<string, string>
      : {},
  };
}

// ── Merge ──────────────────────────────────────────────────────────────────

function mergeRequirements(
  existing: ShoppingContext | null,
  extracted: ExtractedRequirements,
): ShoppingContext {
  const merged: ShoppingContext = {};

  // Category: extracted wins if present, otherwise keep existing
  if (extracted.categoryName) {
    merged.categoryName = extracted.categoryName;
  } else if (existing?.categoryName) {
    merged.categoryName = existing.categoryName;
  }

  // Budget: extracted wins (they might have changed their mind)
  if (extracted.budget) {
    const label = budgetToLabel(extracted.budget);
    if (label) merged.budget = label;
  } else if (existing?.budget) {
    merged.budget = existing.budget;
  }

  // Brand: extracted wins if present
  if (extracted.brand) {
    merged.brand = extracted.brand;
  } else if (existing?.brand) {
    merged.brand = existing.brand;
  }

  // Purpose and other attributes fold into answers
  const existingAnswers = existing?.answers ? { ...existing.answers } : {};

  if (extracted.purpose) {
    existingAnswers.purpose = extracted.purpose;
  }

  for (const [key, value] of Object.entries(extracted.attributes)) {
    if (value) existingAnswers[key] = value;
  }

  if (Object.keys(existingAnswers).length > 0) {
    merged.answers = existingAnswers;
  }

  return merged;
}

// ── Category matching ────────────────────────────────────────────────────

async function findCategoryByName(
  orgId: string,
  categoryName: string,
): Promise<{ id: string; name: string } | null> {
  const normalized = categoryName.toLowerCase().trim();
  const categories = await listCategoriesForWidget(orgId);

  // Exact match first
  const exact = categories.find((c) => c.name.toLowerCase() === normalized);
  if (exact) return { id: exact.id, name: exact.name };

  // Partial match — find the closest by inclusion
  const partial = categories.find(
    (c) => normalized.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(normalized),
  );
  if (partial) return { id: partial.id, name: partial.name };

  return null;
}

// ── Decision logic ─────────────────────────────────────────────────────────

function budgetToLabel(budget: { min: number | null; max: number | null }): string | null {
  if (budget.min === null && budget.max === null) return null;
  const minStr = budget.min !== null ? String(budget.min) : "0";
  const maxStr = budget.max !== null ? String(budget.max) : "";
  return `${minStr}-${maxStr}`;
}

function hasMeaningfulFilters(merged: ShoppingContext): boolean {
  if (merged.categoryName) return true;
  if (merged.budget) return true;
  if (merged.brand) return true;
  if (merged.answers && Object.keys(merged.answers).length > 0) return true;
  return false;
}

function highestValueMissingInfo(merged: ShoppingContext): string | null {
  if (!merged.categoryName) return "category";
  if (!merged.budget) return "budget";
  if (!merged.brand && (!merged.answers || Object.keys(merged.answers).length === 0)) return "preference";
  return null;
}

// ── Follow-up questions ──────────────────────────────────────────────────

function generateFollowUp(missing: string): string {
  switch (missing) {
    case "category":
      return "What type of product are you looking for?";
    case "budget":
      return "Do you have a budget in mind for this?";
    case "preference":
      return "Do you have any particular preferences, like a specific brand or feature you're looking for?";
    default:
      return "Could you tell me a bit more about what you need?";
  }
}

// ── JSON parse helper ──────────────────────────────────────────────────────

function tryParseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return null;
  } catch {
    return null;
  }
}

function isValidBudget(value: unknown): value is { min: number | null; max: number | null } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const min = v.min;
  const max = v.max;
  if (min !== null && typeof min !== "number") return false;
  if (max !== null && typeof max !== "number") return false;
  if (min === null && max === null) return false;
  return true;
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function tryAdaptiveDiscovery(
  orgId: string,
  messageText: string,
  existingContext: ShoppingContext | null,
): Promise<AdaptiveResult | null> {
  try {
    // Step 1: Extract requirements from the message
    const extracted = await extractFromMessage(messageText, existingContext);

    // Not a shopping intent — let normal chat handle it
    if (!extracted.hasShoppingIntent) return null;

    // Step 2: Merge with existing context
    const merged = mergeRequirements(existingContext, extracted);

    // Step 3: Check if we have enough to make a useful recommendation
    if (!hasMeaningfulFilters(merged)) return null;

    // Step 4: Try to find a category
    let categoryId: string | null = null;
    let categoryName = "";

    if (merged.categoryName) {
      const cat = await findCategoryByName(orgId, merged.categoryName);
      if (cat) {
        categoryId = cat.id;
        categoryName = cat.name;
      }
    }

    // If we have category info but can't find it, we need to ask
    if (merged.categoryName && !categoryId) {
      return {
        replyText: `I'm not sure which category "${merged.categoryName}" falls under. Could you pick from the available categories?`,
        recommendations: [],
        fromEngine: false,
        shoppingContext: merged,
      };
    }

    // If we don't have a category yet, ask
    if (!categoryId) {
      const missing = highestValueMissingInfo(merged);
      if (missing) {
        return {
          replyText: generateFollowUp(missing),
          recommendations: [],
          fromEngine: false,
          shoppingContext: merged,
        };
      }
      return null;
    }

    // Step 5: Build answers from merged requirements
    const answers: Record<string, string> = {};

    if (merged.budget) answers.budget = merged.budget;
    if (merged.brand) answers.brand = merged.brand;
    if (merged.answers) {
      for (const [key, value] of Object.entries(merged.answers)) {
        if (value) answers[key] = value;
      }
    }

    // Step 6: Check if we have enough info to recommend
    const missing = highestValueMissingInfo(merged);
    if (missing && !answers.budget && !answers.brand && (!merged.answers || Object.keys(merged.answers).length === 0)) {
      return {
        replyText: generateFollowUp(missing),
        recommendations: [],
        fromEngine: false,
        shoppingContext: merged,
      };
    }

    // Step 7: Call the deterministic recommendation engine
    const products = await recommendProducts({
      orgId,
      categoryId,
      answers,
    });

    if (products.length > 0) {
      const top = products[0];
      const productLine = products.length > 1
        ? `Here are some options I found for you in ${categoryName}:\n\n**${top.name}** — ${top.price}`
        : `I found **${top.name}** — ${top.price} in ${categoryName}.`;

      const restLines = products.slice(1).map(
        (p) => `**${p.name}** — ${p.price}`
      ).join("\n");

      const replyText = restLines
        ? `${productLine}\n${restLines}\n\nWould you like more details on any of these, or refine your search?`
        : `${productLine}\n\nWould you like to know more about it?`;

      return {
        replyText,
        recommendations: products,
        fromEngine: true,
        shoppingContext: merged,
      };
    }

    // No matching products found
    return {
      replyText: `I couldn't find any products matching your requirements in ${categoryName}. Would you like to try a different category or adjust your preferences?`,
      recommendations: [],
      fromEngine: true,
      shoppingContext: merged,
    };
  } catch (err) {
    console.error("Adaptive discovery error, falling through to normal chat:", err);
    return null;
  }
}

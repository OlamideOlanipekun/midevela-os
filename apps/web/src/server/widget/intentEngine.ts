/**
 * Advanced Intent Engine (Milestone B1)
 *
 * Classifies shopper input into structured intent objects:
 *   - PRODUCT_DISCOVERY: "Show me black sneakers"
 *   - CONSTRAINT_REFINEMENT: "Under ₦100k", "Something more casual"
 *   - SIMILARITY: "Something like this", "Show me similar ones"
 *   - COMPARISON: "Which is better?", "What's the difference between the first two?"
 *   - DECISION_SUPPORT: "Which is better for office use?", "Is this worth the price?"
 *   - VARIANT_CHECK: "Do you have this in size 42?", "Is this available in black?"
 *   - NAVIGATION: "Take me to men's shoes", "Open the product page"
 *   - BUSINESS_SUPPORT: "What are your shipping policies?"
 *   - GENERAL_CHAT: Greetings, general conversation
 */

import { completeJson, type ChatMessage } from "@/server/conversation/llm";
import type { ConversationState } from "./conversationState";

export type IntentType =
  | "ADD_TO_CART"
  | "REMOVE_FROM_CART"
  | "UPDATE_CART_QUANTITY"
  | "VIEW_CART"
  | "CHECKOUT"
  | "CART_QUESTION"
  | "PRODUCT_DISCOVERY"
  | "CONSTRAINT_REFINEMENT"
  | "SIMILARITY"
  | "COMPARISON"
  | "DECISION_SUPPORT"
  | "VARIANT_CHECK"
  | "NAVIGATION"
  | "BUSINESS_SUPPORT"
  | "GENERAL_CHAT";

export interface ParsedConstraints {
  category?: string;
  color?: string;
  maxPrice?: number;
  minPrice?: number;
  style?: string;
  useCase?: string;
  brand?: string;
  attributes?: Record<string, string>;
}

export interface VariantQuery {
  size?: string;
  color?: string;
  attributeKey?: string;
  attributeValue?: string;
}

export interface StructuredIntent {
  intent: IntentType;
  constraints: ParsedConstraints;
  variantQuery?: VariantQuery;
  comparisonTargets?: string[];
  decisionContext?: {
    useCase?: string;
    criteria?: string;
  };
  targetReference?: "first" | "second" | "third" | "last" | "active_page" | "all" | string;
  rawQuery: string;
}

// Fast pattern matchers for immediate zero-cost detection
const VARIANT_PATTERNS = [
  /\b(?:do\s+you\s+have|in|come\s+in|available\s+in)\s+size\s+(\d+|[xsml]|small|medium|large|xl|xxl)\b/i,
  /\bsize\s+(\d+|[xsml]|small|medium|large|xl|xxl)\b/i,
  /\b(?:in|available\s+in)\s+(black|white|red|blue|green|yellow|brown|pink|grey|gray|purple|beige|navy)\b/i,
];

const COMPARISON_PATTERNS = [
  /\bcompare\b/i,
  /\bwhat'?s?\s+the\s+difference\b/i,
  /\bhow\s+do\s+they\s+compare\b/i,
  /\bdifference\s+between\b/i,
  /\bvs\b/i,
];

const DECISION_PATTERNS = [
  /\bwhich\s+(?:one\s+)?(?:is\s+better|should\s+i\s+(?:pick|choose|buy))\b/i,
  /\bwhich\s+would\s+you\s+(?:recommend|pick|choose)\b/i,
  /\bis\s+this\s+worth\s+the\s+price\b/i,
  /\bfor\s+(office|work|gym|running|casual|everyday|party|formal|travel)\s+use\b/i,
];

const SIMILARITY_PATTERNS = [
  /\bsomething\s+like\s+this\b/i,
  /\bsimilar\s+(?:ones?|products?|to\s+this)?\b/i,
  /\blike\s+(?:the\s+)?first\s+one\b/i,
  /\bmore\s+like\s+this\b/i,
];

const NAVIGATION_PATTERNS = [
  /\btake\s+me\s+to\b/i,
  /\bopen\s+(?:the\s+)?(?:page|product|link)\b/i,
  /\bgo\s+to\s+product\b/i,
  /\bview\s+product\b/i,
];

/**
 * Fast local constraint parser using regular expressions for quick price & target reference extraction.
 */
export function fastExtractConstraints(message: string): ParsedConstraints {
  const constraints: ParsedConstraints = {};
  const lower = message.toLowerCase();

  // Price extractions: e.g. "under ₦100k", "under 100000", "below 80k", "less than 50k"
  const maxPriceMatch = lower.match(/(?:under|below|less\s+than|max|maximum)\s*(?:₦|ngn|\$)?\s*(\d+)(k)?/i);
  if (maxPriceMatch) {
    const base = parseInt(maxPriceMatch[1], 10);
    const multiplier = maxPriceMatch[2] ? 1000 : 1;
    constraints.maxPrice = base * multiplier;
  }

  // Min price extractions: e.g. "above 20k", "at least 5000"
  const minPriceMatch = lower.match(/(?:above|over|more\s+than|at\s+least|min|minimum)\s*(?:₦|ngn|\$)?\s*(\d+)(k)?/i);
  if (minPriceMatch) {
    const base = parseInt(minPriceMatch[1], 10);
    const multiplier = minPriceMatch[2] ? 1000 : 1;
    constraints.minPrice = base * multiplier;
  }

  // Color extraction
  const colorMatch = lower.match(/\b(black|white|red|blue|green|yellow|brown|pink|grey|gray|purple|beige|navy)\b/i);
  if (colorMatch) {
    constraints.color = colorMatch[1];
  }

  // Style / Use case extraction
  const styleMatch = lower.match(/\b(casual|formal|sporty|streetwear|luxury|minimalist|vintage)\b/i);
  if (styleMatch) {
    constraints.style = styleMatch[1];
  }

  const useCaseMatch = lower.match(/\b(?:for|ideal\s+for)\s+(work|office|gym|running|everyday|party|outdoor|travel)\b/i);
  if (useCaseMatch) {
    constraints.useCase = useCaseMatch[1];
  }

  return constraints;
}

/**
 * Classifies intent using structural pattern matching first, falling back to JSON LLM classification
 * for complex multi-constraint queries.
 */
export async function classifyIntent(
  message: string,
  state?: ConversationState
): Promise<StructuredIntent> {
  const lower = message.trim().toLowerCase();
  const hasRecs = (state?.recommendedProducts?.length ?? 0) > 0;
  const localConstraints = fastExtractConstraints(message);

  // 1. Variant check pattern
  for (const pat of VARIANT_PATTERNS) {
    if (pat.test(lower)) {
      const sizeMatch = lower.match(/\bsize\s+(\d+|[xsml]|small|medium|large|xl|xxl)\b/i);
      const colorMatch = lower.match(/\b(black|white|red|blue|green|yellow|brown|pink|grey|gray|purple|beige|navy)\b/i);
      return {
        intent: "VARIANT_CHECK",
        constraints: localConstraints,
        variantQuery: {
          size: sizeMatch ? sizeMatch[1] : undefined,
          color: colorMatch ? colorMatch[1] : undefined,
        },
        rawQuery: message,
      };
    }
  }

  // 2. Navigation intent pattern
  for (const pat of NAVIGATION_PATTERNS) {
    if (pat.test(lower)) {
      return {
        intent: "NAVIGATION",
        constraints: localConstraints,
        rawQuery: message,
      };
    }
  }

  // 3. Comparison intent pattern
  if (hasRecs || COMPARISON_PATTERNS.some((p) => p.test(lower))) {
    for (const pat of COMPARISON_PATTERNS) {
      if (pat.test(lower)) {
        return {
          intent: "COMPARISON",
          constraints: localConstraints,
          comparisonTargets: ["first", "second"],
          rawQuery: message,
        };
      }
    }
  }

  // 4. Decision support pattern
  for (const pat of DECISION_PATTERNS) {
    if (pat.test(lower)) {
      const useCaseMatch = lower.match(/(?:for|ideal\s+for)\s+(work|office|gym|running|casual|everyday|travel)/i);
      return {
        intent: "DECISION_SUPPORT",
        constraints: localConstraints,
        decisionContext: {
          useCase: useCaseMatch ? useCaseMatch[1] : undefined,
        },
        rawQuery: message,
      };
    }
  }

  // 5. Similarity pattern
  for (const pat of SIMILARITY_PATTERNS) {
    if (pat.test(lower)) {
      return {
        intent: "SIMILARITY",
        constraints: localConstraints,
        targetReference: "first",
        rawQuery: message,
      };
    }
  }

  // 6. Refinement vs Discovery: Check if there are constraints or category
  const isRefinement = hasRecs && (Object.keys(localConstraints).length > 0 || /\b(more|cheaper|other|different|cheapest|better)\b/i.test(lower));

  if (isRefinement) {
    return {
      intent: "CONSTRAINT_REFINEMENT",
      constraints: localConstraints,
      rawQuery: message,
    };
  }

  // 7. For nuanced or multi-faceted queries, use LLM intent extraction fallback
  if (lower.split(" ").length > 3) {
    try {
      const prompt = `Classify this shopping message: "${message}".
Active conversation has recommendations: ${hasRecs}.
Respond ONLY with JSON:
{
  "intent": "PRODUCT_DISCOVERY" | "CONSTRAINT_REFINEMENT" | "SIMILARITY" | "COMPARISON" | "DECISION_SUPPORT" | "VARIANT_CHECK" | "NAVIGATION" | "GENERAL_CHAT",
  "category": string | null,
  "color": string | null,
  "maxPrice": number | null,
  "minPrice": number | null,
  "style": string | null,
  "useCase": string | null,
  "brand": string | null,
  "size": string | null
}`;

      const messages: ChatMessage[] = [{ role: "system", content: prompt }];
      const res = await completeJson(messages);
      const parsed = JSON.parse(res.raw);

      if (parsed && typeof parsed.intent === "string") {
        return {
          intent: parsed.intent as IntentType,
          constraints: {
            category: parsed.category || undefined,
            color: parsed.color || localConstraints.color,
            maxPrice: parsed.maxPrice || localConstraints.maxPrice,
            minPrice: parsed.minPrice || localConstraints.minPrice,
            style: parsed.style || localConstraints.style,
            useCase: parsed.useCase || localConstraints.useCase,
            brand: parsed.brand || undefined,
          },
          variantQuery: parsed.size ? { size: parsed.size, color: parsed.color || undefined } : undefined,
          rawQuery: message,
        };
      }
    } catch (err) {
      console.warn("[IntentEngine] LLM extraction fallback error, using local classification:", err);
    }
  }

  return {
    intent: "PRODUCT_DISCOVERY",
    constraints: localConstraints,
    rawQuery: message,
  };
}

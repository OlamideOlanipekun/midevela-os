/**
 * Intent router — classifies every incoming message before any LLM call.
 *
 * Uses pure pattern matching (no LLM cost). Routes follow a fixed priority.
 * Follow-up intents (details, compare, cheaper) are checked BEFORE new
 * shopping journeys, so a user asking about current products never triggers
 * a reset:
 *
 *   1. PRODUCT_SELECTION     — "the first one", "the serum", "pick #2"
 *   2. PRODUCT_DETAILS       — "tell me more", "is it good for oily skin"
 *   3. COMPARE               — "what's the difference", "compare them"
 *   4. CHEAPER_ALTERNATIVE   — "too expensive", "show cheaper options"
 *   5. NEW_SHOPPING_JOURNEY  — "I'm looking for shoes", "forget skincare"
 *   6. DISCOVERY             — new shopping request in DISCOVERY mode
 *   7. GENERAL_CHAT          — everything else
 *
 * NOTE: PRODUCT_DETAILS is deliberately low priority because many chat
 * phrases ("what are your hours", "how does shipping work", "what about
 * laptops") contain words like "what", "how", "about" that would otherwise
 * match generic product-detail patterns.
 */

import type { ConversationState } from "./conversationState";

export type RouteIntent =
  | "ADD_TO_CART"
  | "REMOVE_FROM_CART"
  | "UPDATE_CART_QUANTITY"
  | "VIEW_CART"
  | "CHECKOUT"
  | "PRODUCT_SELECTION"
  | "PRODUCT_DETAILS"
  | "COMPARE"
  | "CHEAPER_ALTERNATIVE"
  | "NEW_SHOPPING_JOURNEY"
  | "DISCOVERY"
  | "GENERAL_CHAT";

export interface RouteResult {
  intent: RouteIntent;
  /** Resolved product ID for PRODUCT_SELECTION / PRODUCT_DETAILS */
  targetProductId?: string;
  /** Resolved product IDs for COMPARE */
  targetProductIds?: string[];
  /** Detected category mention for NEW_SHOPPING_JOURNEY / DISCOVERY */
  detectedCategory?: string;
}

// ── Pattern lists ──────────────────────────────────────────────────────

const ADD_TO_CART_PATTERNS = [
  /\b(?:add|put)\b.*\b(?:cart|bag)\b/i,
  /\badd\s+(?:it|this|that|one)\b/i,
  /\bi['']?ll\s+take\s+(?:it|this|that|the)\b/i,
  /\badd\s+to\s+cart\b/i,
];

const REMOVE_FROM_CART_PATTERNS = [
  /\b(?:remove|delete)\b.*\b(?:cart|bag)\b/i,
  /\bremove\s+(?:the|this|that)\b/i,
];

const VIEW_CART_PATTERNS = [
  /\b(?:what|show|view|see)\b.*\b(?:cart|bag)\b/i,
  /\bmy\s+cart\b/i,
  /\bhow\s+much\s+is\s+everything\b/i,
];

const CHECKOUT_PATTERNS = [
  /\b(?:checkout|proceed\s+to\s+checkout|buy\s+now|pay\s+now|ready\s+to\s+pay)\b/i,
  /^(?:checkout|buy)\s*$/i,
];

const PRODUCT_SELECTION_SHORT = [
  /^(?:the\s+)?(?:first|second|third|last)\b/,
  /^\d+\s*$/,
  /^(?:i['']?ll\s+|i\s+will\s+)?(?:take|pick|choose|try|go\s+with)\b/i,
  /#\d+/,
];

const PRODUCT_SELECTION_END = [
  /(?:the\s+)?(?:first|second|third|last)\s+(?:one|item|product|option)\s*$/i,
];

const NEW_SHOPPING_PATTERNS = [
  /\b(i['']?m\s+looking\s+for|i\s+want\s+(?:a|an|some|to)|i\s+need\s+(?:a|an|some))\s+(.+)/i,
  /\b(forget|never\s+mind)\s+(.+)/i,
  /\bwhat\s+about\s+(.+)/i,
  /\bchange\b.*\b(mind|topic|category)\b/i,
  /\blet['']?s\s+try\b/i,
  /\b(start|begin)\s+(?:over|fresh|again)\b/i,
  /\bshow\s+me\s+(?:a\s+|an\s+|some\s+)?(.+)/i,
];

const NEW_SHOPPING_STARTERS = [
  /\b(i['']?m\s+looking\s+for|i\s+want\s+(?:a|an|some|to)|i\s+need\s+(?:a|an|some))/i,
  /\b(forget|never\s+mind|actually|instead|what\s+about)/i,
];

const COMPARE_PATTERNS = [
  /\bwhat'?s?\s+the\s+difference\b/i,
  /\bhow\s+do\s+they\s+compare\b/i,
  /\bcompare\s+(them|these|those|the\s+products)\b/i,
  /\bwhich\s+(one\s+)?is\s+better\b/i,
  /\bwhich\s+(one\s+)?should\s+(i|we)\b/i,
  /\bdifference\s+between\b/i,
  /\bvs\b/i,
];

const CHEAPER_ALTERNATIVE_PATTERNS = [
  /\bcheaper\b/i,
  /\btoo\s+expensive\b/i,
  /\bout\s+of\s+(my\s+)?budget\b/i,
  /\baffordable\b/i,
  /\bbudget[\s.]/i,
  /\bcostly\b/i,
  /\bsave\s+money\b/i,
  /\b(?:cheaper|more\s+affordable|lower\s+priced)\b/i,
  /\blower\s+price\b/i,
  /\bbetter\s+deal\b/i,
  /\bshow\s+(more|another|other|different)\b/i,
  /\b(?:anything|something)\s+else\b/i,
];

const PRODUCT_DETAILS_PATTERNS = [
  /\btell\s+me\s+more\b/i,
  /\bmore\s+details?\b/i,
  /\bgive\s+me\s+details?\b/i,
  /\bdetails?\s+please\b/i,
  /\bdescribe\b/i,
  /\btell\s+me\s+about\s+(?:it|this|that|the)\b/i,
  /\bcan\s+you\s+tell\s+me\b/i,
  /^(?:what\s+(?:is|about))\s+(?:it|this|that|the)/i,
  /^(?:how\s+(?:does|is|about))\s+(?:it|this|that|the)/i,
  /\bis\s+it\s+good\b/i,
  /\bis\s+it\s+available\b/i,
  /\bdoes\s+it\s+work\b/i,
  /\bdoes\s+it\s+come\s+in\b/i,
  /\brecommend\s+one\b/i,
  /\bwhich\s+one\s+(?:do\s+you\s+)?(?:recommend|should)/i,
];

const CHAT_ONLY = [
  /^(?:hi|hello|hey|thanks|thank|bye|ok|sure|yes|no|good|great|awesome|cool)\b/i,
  /^(?:how\s+(?:are|is|does)|who\s+(?:are|is)|where\s+(?:are|is))/i,
  /\b(?:shipping|return|policy|hours|location|contact|support|help)\b/i,
];

function isChatOnly(message: string): boolean {
  for (const pat of CHAT_ONLY) {
    if (pat.test(message)) return true;
  }
  return false;
}

// ── Router ─────────────────────────────────────────────────────────────

export function routeConversation(
  message: string,
  state: ConversationState,
): RouteResult {
  const hasRecs = (state.recommendedProducts?.length ?? 0) > 0;
  const hasRecsCount = state.recommendedProducts?.length ?? 0;
  const lower = message.toLowerCase().trim();

  // ── Priority 0: Commerce Actions (CHECKOUT, ADD_TO_CART, REMOVE_FROM_CART, VIEW_CART) ──
  for (const pat of CHECKOUT_PATTERNS) {
    if (pat.test(lower)) return { intent: "CHECKOUT" };
  }
  for (const pat of ADD_TO_CART_PATTERNS) {
    if (pat.test(lower)) return { intent: "ADD_TO_CART" };
  }
  for (const pat of REMOVE_FROM_CART_PATTERNS) {
    if (pat.test(lower)) return { intent: "REMOVE_FROM_CART" };
  }
  for (const pat of VIEW_CART_PATTERNS) {
    if (pat.test(lower)) return { intent: "VIEW_CART" };
  }

  // ── Priority 1: PRODUCT_SELECTION ──
  if (hasRecs) {
    for (const pat of PRODUCT_SELECTION_SHORT) {
      if (pat.test(lower)) return { intent: "PRODUCT_SELECTION" };
    }
    for (const pat of PRODUCT_SELECTION_END) {
      if (pat.test(lower)) return { intent: "PRODUCT_SELECTION" };
    }
  }

  // ── Priority 2: PRODUCT_DETAILS ──
  // Only if there are recommendations and the message isn't clearly chat.
  if (hasRecs && !isChatOnly(lower)) {
    for (const pat of PRODUCT_DETAILS_PATTERNS) {
      if (pat.test(lower)) return { intent: "PRODUCT_DETAILS" };
    }
  }

  // ── Priority 3: COMPARE ──
  if (hasRecsCount >= 2) {
    for (const pat of COMPARE_PATTERNS) {
      if (pat.test(lower)) return { intent: "COMPARE" };
    }
  }

  // ── Priority 4: CHEAPER_ALTERNATIVE ──
  if (hasRecs) {
    for (const pat of CHEAPER_ALTERNATIVE_PATTERNS) {
      if (pat.test(lower)) return { intent: "CHEAPER_ALTERNATIVE" };
    }
  }

  // ── Priority 5: NEW_SHOPPING_JOURNEY ──
  // Only when there's an active shopping context to replace (not in DISCOVERY
  // or GENERAL_CHAT, which have no established context).
  if (state.mode !== "DISCOVERY" && state.mode !== "GENERAL_CHAT") {
    for (const pat of NEW_SHOPPING_PATTERNS) {
      const match = lower.match(pat);
      if (match) {
        const detectedCategory = match[2]?.trim() || match[1]?.trim();
        return { intent: "NEW_SHOPPING_JOURNEY", detectedCategory };
      }
    }

    // Single-word category change when conversation was about something else.
    // Only triggers for actual single-word messages (not phrases like
    // "compare them" or "tell me more").
    const singleWordMatch = lower.match(/^(?:actually\s+|just\s+)?(\w+)\s*$/i);
    if (singleWordMatch) {
      const word = singleWordMatch[1];
      const isGeneric = /^(?:thanks|ok|sure|yes|no|bye|hello|hi|good|great|more|this|that|it|them|here|there)$/i.test(word);
      if (
        !isGeneric &&
        state.categoryName &&
        !lower.includes(state.categoryName.toLowerCase())
      ) {
        return { intent: "NEW_SHOPPING_JOURNEY", detectedCategory: word };
      }
    }
  }

  // ── Priority 6: DISCOVERY ──
  if (state.mode === "DISCOVERY" || state.mode === "QUALIFICATION") {
    if (!isChatOnly(lower) && lower.length > 0) {
      return { intent: "DISCOVERY" };
    }
  }

  // ── Priority 7: GENERAL_CHAT ──
  return { intent: "GENERAL_CHAT" };
}

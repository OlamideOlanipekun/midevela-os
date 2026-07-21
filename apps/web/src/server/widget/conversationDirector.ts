import { routeConversation, type RouteIntent, type RouteResult } from "./intentRouter";
import type { ConversationState, ConversationGoal } from "./conversationState";
import type { answerBusinessQuestion } from "./businessBrain";
import type { handleBrowse } from "./browseHandler";

export interface DirectorDecision {
  /** The route to take — maps to an engine/handler */
  route:
    | "BUSINESS_SUPPORT"
    | "BROWSE_CATEGORIES"
    | "CHECKOUT"
    | "OBJECTION_HANDLING"
    | "ESCALATION"
    | "SHOPPING"
    | "GENERAL_CHAT";

  /** The intent detected by the router */
  intent: RouteIntent;

  /** The original route result for downstream handlers */
  routeResult: RouteResult;

  /** Current goal, or the goal we should transition to */
  goal: ConversationGoal;

  /** Suggested next best action for the shopper */
  nextBestAction?: string;
}

// ── Quick pattern checks for routes that bypass the intent router ────────

const BUSINESS_PATTERNS = [
  /\b(?:ship|delivery|shipping|return|refund|exchange|hour|open|close|payment|warranty|policy|contact|whatsapp|address)\b/i,
  /\bhow\s+(?:do\s+)?(?:i|you|can|does)\s+(?:return|ship|pay|contact)\b/i,
];

const BROWSE_PATTERNS = [
  /^(?:show|browse|view|see|list|what)\s+(?:me\s+)?(?:my\s+)?(?:categories?|products?|items?|collection)/i,
  /^(?:what\s+(?:do\s+)?you\s+(?:have|sell|offer)|what\s+is\s+available)/i,
  /^(?:categories?|products?|items?|collection)\s*(?:\?|$)/i,
];

const CHECKOUT_PATTERNS = [
  /^(?:i['']?ll\s+)?(?:take|buy|get|purchase|order)\s+(?:it|this|that|the|one)\s*$/i,
  /\b(?:check\s*out|checkout|buy\s+now|add\s+to\s+cart|purchase|place\s+order)\b/i,
  /^(?:i['']?ll\s+)?(?:take|buy|get|purchase|order)\s+(?:it|this|that)\b/i,
  /\bhow\s+(?:do\s+)?(?:i|can)\s+(?:buy|order|get|purchase)\b/i,
];

const CHECKOUT_AGREEMENT_PATTERNS = [
  /^(?:yes|yeah|sure|ok|okay|go\s+ahead|do\s+it|send\s+(?:it|me|the))\s*$/i,
  /\bhold\s+(?:it|this|that|one)\b/i,
  /\bsend\s+(?:me\s+)?(?:the\s+)?(?:link|payment\s+link|checkout)\b/i,
  /\bi['']?ll\s+(?:take|buy|get)\s+(?:it|this|that)\b/i,
  /\bgive\s+(?:me|it)\s+(?:the\s+)?(?:link|details?\s+to\s+buy)\b/i,
];

const OBJECTION_PATTERNS = [
  /\b(?:too\s+expensive|out\s+of\s+(?:my\s+)?budget|i\s+don't\s+like|costly|overpriced)\b/i,
  /\b(?:cheaper|more\s+affordable|lower\s+price|better\s+deal)\b/i,
];

function matchesAny(message: string, patterns: RegExp[]): boolean {
  const lower = message.toLowerCase().trim();
  return patterns.some((p) => p.test(lower));
}

/**
 * The Conversation Director — the single entry point for every message.
 *
 * It never replies directly. It only decides which engine to call:
 *
 *   1. BUSINESS_SUPPORT  → Business Brain
 *   2. BROWSE_CATEGORIES → Browse/Category Engine
 *   3. CHECKOUT          → Checkout Handler
 *   4. OBJECTION_HANDLING → Recommendation Engine (relaxed)
 *   5. SHOPPING          → Discovery/Qualification/Recommendation Engine
 *   6. GENERAL_CHAT      → Normal LLM conversation
 *   7. ESCALATION        → Escalation Engine
 */
export function directConversation(
  message: string,
  state: ConversationState,
  /** Whether the assistant has repeated itself or seems confused */
  isConfused?: boolean,
): DirectorDecision {
  const lower = message.toLowerCase().trim();

  // 1. Business questions — check before anything else
  if (matchesAny(lower, BUSINESS_PATTERNS)) {
    return {
      route: "BUSINESS_SUPPORT",
      intent: "GENERAL_CHAT",
      routeResult: { intent: "GENERAL_CHAT" },
      goal: "BUSINESS_SUPPORT",
      nextBestAction: "Is there anything else I can help you with?",
    };
  }

  // 2. Browse categories
  if (matchesAny(lower, BROWSE_PATTERNS) && !matchesAny(lower, BUSINESS_PATTERNS)) {
    return {
      route: "BROWSE_CATEGORIES",
      intent: "GENERAL_CHAT",
      routeResult: { intent: "GENERAL_CHAT" },
      goal: "DISCOVERY",
      nextBestAction: "Which category interests you?",
    };
  }

  // 3. Checkout intent — direct "I'll take it"
  if (matchesAny(lower, CHECKOUT_PATTERNS) && state.activeProductId) {
    return {
      route: "CHECKOUT",
      intent: "PRODUCT_SELECTION",
      routeResult: { intent: "PRODUCT_SELECTION" },
      goal: "CHECKOUT",
      nextBestAction: "Would you like to continue shopping?",
    };
  }

  // 3b. Checkout agreement — "yes", "hold it", "send link" when the
  //     assistant previously offered to create a payment link.
  if (
    matchesAny(lower, CHECKOUT_AGREEMENT_PATTERNS) &&
    state.waitingFor === "checkout_confirmation"
  ) {
    return {
      route: "CHECKOUT",
      intent: "GENERAL_CHAT",
      routeResult: { intent: "GENERAL_CHAT" },
      goal: "CHECKOUT",
      nextBestAction: "Would you like to continue shopping?",
    };
  }

  // 4. Objection handling (price, brand, etc.)
  if (matchesAny(lower, OBJECTION_PATTERNS) && (state.recommendedProducts?.length ?? 0) > 0) {
    return {
      route: "OBJECTION_HANDLING",
      intent: "CHEAPER_ALTERNATIVE",
      routeResult: { intent: "CHEAPER_ALTERNATIVE" },
      goal: "RECOMMENDATION",
      nextBestAction: "Would you like more details on any of these?",
    };
  }

  // 5. Run the intent router for all shopping / conversation intents
  const routeResult = routeConversation(message, state);
  const intent = routeResult.intent;

  switch (intent) {
    case "PRODUCT_SELECTION":
    case "PRODUCT_DETAILS":
      return {
        route: "SHOPPING",
        intent,
        routeResult,
        goal: "PRODUCT_DETAILS",
        nextBestAction: "Would you like to compare or see another product?",
      };

    case "COMPARE":
      return {
        route: "SHOPPING",
        intent,
        routeResult,
        goal: "COMPARE",
        nextBestAction: "Would you like to know more about either of these?",
      };

    case "CHEAPER_ALTERNATIVE":
      return {
        route: "SHOPPING",
        intent,
        routeResult,
        goal: "RECOMMENDATION",
        nextBestAction: "Would you like more details on any of these?",
      };

    case "NEW_SHOPPING_JOURNEY":
    case "DISCOVERY":
      return {
        route: "SHOPPING",
        intent,
        routeResult,
        goal: "DISCOVERY",
        nextBestAction: "Let me know what you're looking for.",
      };

    case "GENERAL_CHAT":
      // Check for escalation (repeated confusion)
      if (isConfused) {
        return {
          route: "ESCALATION",
          intent,
          routeResult,
          goal: "ESCALATION",
          nextBestAction: "Would you like to contact the team?",
        };
      }
      return {
        route: "GENERAL_CHAT",
        intent,
        routeResult,
        goal: "GENERAL_CHAT",
      };

    default:
      return {
        route: "GENERAL_CHAT",
        intent,
        routeResult,
        goal: "GENERAL_CHAT",
      };
  }
}

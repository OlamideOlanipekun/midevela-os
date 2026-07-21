// ── Conversation mode constants ───────────────────────────────────────────
//
// The widget's conversation uses an explicit state machine stored in
// conversation.context.mode. This prevents adaptive discovery from
// restarting qualification after recommendations have already been shown.
//
//   DISCOVERY       → Initial state. Adaptive discovery runs to identify
//                     what the shopper wants. May transition to QUALIFICATION
//                     if partial info, or RECOMMENDATION if enough info.
//   QUALIFICATION   → Adaptive discovery is asking follow-up questions
//                     (budget, preferences, etc.). Still collecting info
//                     before recommending.
//   RECOMMENDATION  → Products have been recommended. Follow-up messages
//                     (details, compare, constraint change) are handled
//                     by dedicated handlers. Only a clear "new_search"
//                     transitions back to DISCOVERY.
//   GENERAL_CHAT    → Non-shopping conversation. Normal LLM chat handles
//                     this. If shopping intent appears, transitions to
//                     DISCOVERY.
// ──────────────────────────────────────────────────────────────────────────

export type ConversationMode = "DISCOVERY" | "QUALIFICATION" | "RECOMMENDATION" | "GENERAL_CHAT";

export interface StoredRecommendation {
  id: string;
  name: string;
  brand: string | null;
  price: string;
  imageUrl: string | null;
  url: string | null;
  inStock: boolean;
}

export function getInitialMode(): ConversationMode {
  return "DISCOVERY";
}

/** Determine the next mode based on what adaptive discovery returned */
export function modeForAdaptiveResult(
  hasRecommendations: boolean,
  isAskingFollowUp: boolean,
): ConversationMode {
  if (hasRecommendations) return "RECOMMENDATION";
  if (isAskingFollowUp) return "QUALIFICATION";
  return "DISCOVERY";
}

/** Determine the next mode based on follow-up classification intent */
export function modeForFollowUpType(
  type: "product_details" | "compare" | "constraint_change" | "new_search" | "unrelated" | null,
): ConversationMode | null {
  switch (type) {
    case "product_details":
    case "compare":
    case "constraint_change":
      return "RECOMMENDATION";
    case "new_search":
      return "DISCOVERY";
    case "unrelated":
    case null:
      return "GENERAL_CHAT";
  }
}

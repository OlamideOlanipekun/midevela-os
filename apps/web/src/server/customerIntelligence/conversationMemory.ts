import { ShopperSessionState, SmartConversationMemory } from "./types";

export function buildSmartConversationMemory(
  sessionState: ShopperSessionState,
  cartInfo?: { itemCount: number; totalAmount: number; productIds: string[] },
  openQuestions: string[] = []
): SmartConversationMemory {
  const explicitPrefs: Record<string, string> = {};
  for (const [k, v] of Object.entries(sessionState.explicitPreferences || {})) {
    explicitPrefs[k] = v.value;
  }

  const inferredPrefs: Record<string, { value: string; confidence: number }> = {};
  for (const [k, v] of Object.entries(sessionState.inferredPreferences || {})) {
    if (v.confidence >= 0.6) {
      inferredPrefs[k] = { value: v.value, confidence: v.confidence };
    }
  }

  return {
    intent: sessionState.currentIntent || "general_shopping",
    intentStage: sessionState.intentStage || "INITIAL",
    constraints: sessionState.intentConstraints || {},
    shortlist: sessionState.shortlist || [],
    currentProduct: sessionState.pageContext?.activeProductId || undefined,
    currentCart: cartInfo
      ? {
          itemCount: cartInfo.itemCount,
          totalAmount: cartInfo.totalAmount,
          productIds: cartInfo.productIds,
        }
      : undefined,
    importantPreferences: {
      explicit: explicitPrefs,
      inferred: inferredPrefs,
    },
    openQuestions,
    journeyState: sessionState.journeyState || "DISCOVERY",
    segment: sessionState.segment || "NEW_VISITOR",
  };
}

export function formatSmartMemoryForPrompt(memory: SmartConversationMemory): string {
  const lines: string[] = [];

  lines.push(`SHOPPER MEMORY STATE:`);
  lines.push(`- Current Intent: ${memory.intent} (Stage: ${memory.intentStage})`);
  lines.push(`- Journey Funnel State: ${memory.journeyState}`);
  lines.push(`- Customer Segment: ${memory.segment}`);

  if (Object.keys(memory.constraints).length > 0) {
    lines.push(`- Active Constraints: ${JSON.stringify(memory.constraints)}`);
  }

  if (memory.shortlist.length > 0) {
    lines.push(`- Shortlisted Products: [${memory.shortlist.join(", ")}]`);
  }

  if (memory.currentProduct) {
    lines.push(`- Active Product on Screen: ${memory.currentProduct}`);
  }

  if (memory.currentCart && memory.currentCart.itemCount > 0) {
    lines.push(
      `- Cart State: ${memory.currentCart.itemCount} item(s) (Total: ${memory.currentCart.totalAmount}) [${memory.currentCart.productIds.join(
        ", "
      )}]`
    );
  }

  if (Object.keys(memory.importantPreferences.explicit).length > 0) {
    lines.push(`- Stated Preferences: ${JSON.stringify(memory.importantPreferences.explicit)}`);
  }

  if (Object.keys(memory.importantPreferences.inferred).length > 0) {
    lines.push(
      `- Inferred Preferences (Frame as gentle suggestions): ${JSON.stringify(
        memory.importantPreferences.inferred
      )}`
    );
  }

  if (memory.openQuestions.length > 0) {
    lines.push(`- Information Still Needed: ${memory.openQuestions.join(", ")}`);
  }

  return lines.join("\n");
}

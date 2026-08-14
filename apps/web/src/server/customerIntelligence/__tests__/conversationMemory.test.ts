import { describe, it, expect } from "vitest";
import { buildSmartConversationMemory, formatSmartMemoryForPrompt } from "../conversationMemory";
import { ShopperSessionState } from "../types";

describe("Smart Conversation Memory Engine", () => {
  const dummySession: ShopperSessionState = {
    id: "s1",
    orgId: "org1",
    sessionId: "sess123",
    isAnonymous: true,
    journeyState: "COMPARISON",
    intentStage: "CONSTRAINED",
    currentIntent: "running shoes",
    intentConstraints: { maxPrice: 100000, color: "black" },
    scores: {
      purchaseIntentScore: 5,
      cartIntentScore: 6,
      comparisonIntentScore: 3,
      productInterestScores: {},
      categoryInterestScores: {},
      brandInterestScores: {},
    },
    explicitPreferences: {
      color: { key: "color", value: "black", confidence: 1.0, source: "SHOPPER_STATEMENT", updatedAt: "" },
    },
    inferredPreferences: {
      brand: { key: "brand", value: "Nike", confidence: 0.7, evidenceCount: 2, source: "BEHAVIORAL_INFERENCE", updatedAt: "" },
    },
    categoriesViewed: [],
    productsViewed: ["p1", "p2"],
    productsCompared: ["p1", "p2"],
    shortlist: ["p1", "p2"],
    pageContext: { activeProductId: "p2" },
    segment: "HIGH_INTENT",
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  it("builds structured memory and formats prompt text concisely", () => {
    const memory = buildSmartConversationMemory(dummySession, {
      itemCount: 1,
      totalAmount: 95000,
      productIds: ["p2"],
    });

    expect(memory.intent).toBe("running shoes");
    expect(memory.shortlist).toEqual(["p1", "p2"]);
    expect(memory.currentProduct).toBe("p2");

    const promptText = formatSmartMemoryForPrompt(memory);
    expect(promptText).toContain("SHOPPER MEMORY STATE");
    expect(promptText).toContain("Shortlisted Products: [p1, p2]");
    expect(promptText).toContain("Cart State: 1 item(s)");
  });
});

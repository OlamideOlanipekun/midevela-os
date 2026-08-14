import { describe, it, expect } from "vitest";
import { scoreAndRankProducts } from "../personalizedRanker";
import { ShopperSessionState } from "../types";

describe("Personalized Product Ranker Engine", () => {
  const dummySession: ShopperSessionState = {
    id: "s1",
    orgId: "org1",
    sessionId: "sess123",
    isAnonymous: true,
    journeyState: "EXPLORATION",
    intentStage: "CONSTRAINED",
    currentIntent: "running shoes",
    intentConstraints: { maxPrice: 100000, brand: "Nike" },
    scores: {
      purchaseIntentScore: 2,
      cartIntentScore: 0,
      comparisonIntentScore: 0,
      productInterestScores: { p2: 5 },
      categoryInterestScores: {},
      brandInterestScores: { Nike: 3 },
    },
    explicitPreferences: {
      color: { key: "color", value: "black", confidence: 1.0, source: "SHOPPER_STATEMENT", updatedAt: "" },
    },
    inferredPreferences: {},
    categoriesViewed: [],
    productsViewed: ["p2"],
    productsCompared: [],
    shortlist: [],
    pageContext: {},
    segment: "NEW_VISITOR",
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  it("ranks Nike black running shoe under N100k highest", () => {
    const products = [
      { id: "p1", name: "Generic Shoe", price: 120000, brand: "Adidas", attributes: { color: "red" } },
      { id: "p2", name: "Nike Pegasus Black", price: 95000, brand: "Nike", attributes: { color: "black" } },
    ];

    const ranked = scoreAndRankProducts(products, dummySession);
    expect(ranked[0].productId).toBe("p2");
    expect(ranked[0].finalRankScore).toBeGreaterThan(ranked[1].finalRankScore);
  });
});

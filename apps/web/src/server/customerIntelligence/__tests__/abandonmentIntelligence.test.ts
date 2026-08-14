import { describe, it, expect } from "vitest";
import { analyzeAbandonmentJourney, generateContextualRecovery } from "../abandonmentIntelligence";
import { ShopperSessionState } from "../types";

describe("Abandonment Intelligence Engine", () => {
  const dummySession: ShopperSessionState = {
    id: "s1",
    orgId: "org1",
    sessionId: "sess123",
    isAnonymous: true,
    journeyState: "CART",
    intentStage: "CONSTRAINED",
    currentIntent: "running shoes",
    intentConstraints: { maxPrice: 50000 },
    scores: {
      purchaseIntentScore: 5,
      cartIntentScore: 6,
      comparisonIntentScore: 0,
      productInterestScores: {},
      categoryInterestScores: {},
      brandInterestScores: {},
    },
    explicitPreferences: {},
    inferredPreferences: {},
    categoriesViewed: [],
    productsViewed: ["p1"],
    productsCompared: [],
    shortlist: [],
    pageContext: {},
    segment: "CART_ABANDONER",
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  it("identifies shipping concern abandonment with evidence", () => {
    const events = [
      { eventType: "PRODUCT_VIEW", pageUrl: "/products/shoe-1" },
      { eventType: "PRODUCT_ADDED", pageUrl: "/products/shoe-1" },
      { eventType: "PAGE_VIEW", pageUrl: "/shipping-policy" },
      { eventType: "CHECKOUT_STARTED", pageUrl: "/checkout" },
    ];

    const hypothesis = analyzeAbandonmentJourney(dummySession, events, {
      cartId: "cart1",
      totalValue: 75000,
      itemCount: 1,
    });

    expect(hypothesis.reason).toBe("SHIPPING_CONCERN");
    expect(hypothesis.confidence).toBeGreaterThanOrEqual(0.8);
    expect(hypothesis.evidence.some((e) => e.includes("shipping"))).toBe(true);

    const plan = generateContextualRecovery(hypothesis);
    expect(plan.eligible).toBe(true);
    expect(plan.suggestedMessage).toContain("Delivery options");
  });

  it("identifies price concern abandonment when cart exceeds budget limit", () => {
    const events = [
      { eventType: "SEARCH", metadata: { query: "cheap running shoes" } },
      { eventType: "PRODUCT_ADDED" },
    ];

    const hypothesis = analyzeAbandonmentJourney(dummySession, events, {
      cartId: "cart2",
      totalValue: 80000,
      itemCount: 1,
    });

    expect(hypothesis.reason).toBe("PRICE_CONCERN");
    expect(hypothesis.confidence).toBeGreaterThanOrEqual(0.8);

    const plan = generateContextualRecovery(hypothesis);
    expect(plan.suggestedMessage).toContain("budget");
  });
});

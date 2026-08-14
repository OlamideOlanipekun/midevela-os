import { describe, it, expect } from "vitest";
import { RankingEngine } from "../rankingEngine";
import { ProductFeatureVector, DEFAULT_RANKING_WEIGHTS } from "../types";

describe("RankingEngine - Recommendation Learning & Scoring", () => {
  it("calculates correct score breakdown for trained product", () => {
    const fv: ProductFeatureVector = {
      productId: "prod1",
      name: "Pro Running Shoes",
      price: 85000,
      category: "Footwear",
      inStock: true,
      semanticSimilarity: 0.9,
      historicalCtr: 0.25,
      historicalCartRate: 0.15,
      historicalConversionRate: 0.08,
      returnRate: 0.02,
      intentConversionRate: 0.12,
      userPreferenceMatch: 0.8,
      isMerchantPinned: false,
      merchantBoostFactor: 1.0,
    };

    const { score, breakdown } = RankingEngine.calculateScore(fv, DEFAULT_RANKING_WEIGHTS);

    expect(score).toBeGreaterThan(0.4);
    expect(breakdown).toHaveProperty("semantic");
    expect(breakdown).toHaveProperty("intent");
    expect(breakdown).toHaveProperty("conversion");
    expect(breakdown).toHaveProperty("return_penalty");
  });

  it("handles cold-start fallback formula when product has zero historical data", () => {
    const fv: ProductFeatureVector = {
      productId: "prod2",
      name: "Brand New Shoe",
      price: 60000,
      category: "Footwear",
      inStock: true,
      semanticSimilarity: 0.85,
      historicalCtr: 0,
      historicalCartRate: 0,
      historicalConversionRate: 0,
      returnRate: 0,
      intentConversionRate: 0,
      userPreferenceMatch: 0.5,
      isMerchantPinned: false,
      merchantBoostFactor: 1.2,
    };

    const { score, breakdown } = RankingEngine.calculateScore(fv, DEFAULT_RANKING_WEIGHTS);

    expect(score).toBeGreaterThan(0);
    expect(breakdown).toHaveProperty("cold_start_semantic");
    expect(breakdown).toHaveProperty("merchant_boost");
  });

  it("ranks pinned items first and filters excluded products", async () => {
    const candidates = [
      { id: "p1", name: "Shoe A", price: 50000, category: "Footwear", similarity: 0.7, inStock: true },
      { id: "p2", name: "Shoe B (Excluded)", price: 60000, category: "Footwear", similarity: 0.9, inStock: true },
      { id: "p3", name: "Shoe C (Pinned)", price: 70000, category: "Footwear", similarity: 0.6, inStock: true },
    ];

    const merchantRules = [
      { id: "r1", type: "EXCLUDE" as const, productId: "p2" },
      { id: "r2", type: "PIN" as const, productId: "p3" },
    ];

    const ranked = await RankingEngine.rankCandidates("org1", candidates, {
      merchantRules,
      explorationRate: 0, // disable random swap for test stability
    });

    expect(ranked.length).toBe(2); // p2 excluded
    expect(ranked[0].productId).toBe("p3"); // p3 pinned first
  });
});

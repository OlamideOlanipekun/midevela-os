import { describe, it, expect } from "vitest";
import { updateScoresForEvent, computeProductRelevanceScore } from "../behaviorScorer";
import { BehavioralScores } from "../types";

describe("Behavioral Scorer Engine", () => {
  it("increments product interest score on view with bonus on repeat view", () => {
    let scores: BehavioralScores = {
      purchaseIntentScore: 0,
      cartIntentScore: 0,
      comparisonIntentScore: 0,
      productInterestScores: {},
      categoryInterestScores: {},
      brandInterestScores: {},
    };

    scores = updateScoresForEvent(scores, "PRODUCT_VIEW", "prod_1", "cat_shoes", "Nike");
    expect(scores.productInterestScores["prod_1"]).toBe(1);

    // Second view gets bonus (+1 weight + 2 bonus = +3 => total 4)
    scores = updateScoresForEvent(scores, "PRODUCT_VIEW", "prod_1", "cat_shoes", "Nike");
    expect(scores.productInterestScores["prod_1"]).toBe(4);
  });

  it("increments scores on cart addition and checkout started", () => {
    let scores: BehavioralScores = {
      purchaseIntentScore: 0,
      cartIntentScore: 0,
      comparisonIntentScore: 0,
      productInterestScores: {},
      categoryInterestScores: {},
      brandInterestScores: {},
    };

    scores = updateScoresForEvent(scores, "PRODUCT_ADDED", "prod_1");
    expect(scores.cartIntentScore).toBe(6);

    scores = updateScoresForEvent(scores, "CHECKOUT_STARTED");
    expect(scores.purchaseIntentScore).toBe(10.1);
  });

  it("calculates product relevance score incorporating brand & category bonuses", () => {
    const scores: BehavioralScores = {
      purchaseIntentScore: 10,
      cartIntentScore: 6,
      comparisonIntentScore: 3,
      productInterestScores: { prod_1: 4 },
      categoryInterestScores: { cat_shoes: 5 },
      brandInterestScores: { Nike: 6 },
    };

    const total = computeProductRelevanceScore("prod_1", scores, "cat_shoes", "Nike");
    // 4 + (5 * 0.5) + (6 * 0.5) = 4 + 2.5 + 3 = 9.5
    expect(total).toBe(9.5);
  });
});

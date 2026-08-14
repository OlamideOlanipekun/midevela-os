import { BehavioralScores, BehavioralEventType } from "./types";

export const EVENT_WEIGHTS: Record<BehavioralEventType, number> = {
  PAGE_VIEW: 0.5,
  SEARCH: 1,
  FILTER: 1,
  PRODUCT_VIEW: 1,
  PRODUCT_CLICK: 1.5,
  PRODUCT_COMPARE: 3,
  PRODUCT_RECOMMENDED: 0.5,
  PRODUCT_ADDED: 6,
  PRODUCT_REMOVED: -3,
  CART_VIEWED: 4,
  CHECKOUT_STARTED: 10,
  CHECKOUT_ABANDONED: 2,
  PURCHASE: 20,
};

export function updateScoresForEvent(
  currentScores: BehavioralScores,
  eventType: BehavioralEventType,
  productId?: string,
  categoryId?: string,
  brand?: string,
  comparedProductIds?: string[]
): BehavioralScores {
  const scores: BehavioralScores = {
    purchaseIntentScore: currentScores.purchaseIntentScore || 0,
    cartIntentScore: currentScores.cartIntentScore || 0,
    comparisonIntentScore: currentScores.comparisonIntentScore || 0,
    productInterestScores: { ...(currentScores.productInterestScores || {}) },
    categoryInterestScores: { ...(currentScores.categoryInterestScores || {}) },
    brandInterestScores: { ...(currentScores.brandInterestScores || {}) },
  };

  const weight = EVENT_WEIGHTS[eventType] || 1;

  // General Intent Scores
  if (eventType === "CHECKOUT_STARTED" || eventType === "PURCHASE") {
    scores.purchaseIntentScore += weight;
  } else if (eventType === "PRODUCT_ADDED" || eventType === "CART_VIEWED") {
    scores.cartIntentScore += weight;
  } else if (eventType === "PRODUCT_COMPARE") {
    scores.comparisonIntentScore += weight;
  } else {
    scores.purchaseIntentScore += weight * 0.1;
  }

  // Product Interest Scores
  if (productId) {
    const existing = scores.productInterestScores[productId] || 0;
    // View twice bonus logic (+2 bonus on repeated view)
    const bonus = eventType === "PRODUCT_VIEW" && existing > 0 ? 2 : 0;
    scores.productInterestScores[productId] = Math.max(0, existing + weight + bonus);
  }

  // Product Compare Scores
  if (comparedProductIds && comparedProductIds.length > 0) {
    for (const pId of comparedProductIds) {
      const existing = scores.productInterestScores[pId] || 0;
      scores.productInterestScores[pId] = Math.max(0, existing + 3);
    }
  }

  // Category Interest Scores
  if (categoryId) {
    const existing = scores.categoryInterestScores[categoryId] || 0;
    scores.categoryInterestScores[categoryId] = Math.max(0, existing + weight);
  }

  // Brand Interest Scores
  if (brand) {
    const existing = scores.brandInterestScores[brand] || 0;
    scores.brandInterestScores[brand] = Math.max(0, existing + weight);
  }

  return scores;
}

export function computeProductRelevanceScore(
  productId: string,
  scores: BehavioralScores,
  categoryId?: string,
  brand?: string
): number {
  let score = scores.productInterestScores[productId] || 0;

  if (categoryId && scores.categoryInterestScores[categoryId]) {
    score += scores.categoryInterestScores[categoryId] * 0.5;
  }

  if (brand && scores.brandInterestScores[brand]) {
    score += scores.brandInterestScores[brand] * 0.5;
  }

  return Math.round(score * 10) / 10;
}

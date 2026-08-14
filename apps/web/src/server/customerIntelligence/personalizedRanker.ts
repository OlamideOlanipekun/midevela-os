import { ShopperSessionState, PersonalizedRankingFactors, OutcomeFeedback } from "./types";

export interface RankableProduct {
  id: string;
  name: string;
  price: number | string;
  brand?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  attributes?: Record<string, any>;
}

const outcomeFeedbackStore: OutcomeFeedback[] = [];

export function scoreAndRankProducts(
  products: RankableProduct[],
  sessionState: ShopperSessionState
): PersonalizedRankingFactors[] {
  const { intentConstraints, scores, explicitPreferences, inferredPreferences, productsViewed } = sessionState;

  const ranked: PersonalizedRankingFactors[] = products.map((prod) => {
    let baseRelevanceScore = 50;

    // 1. Intent & constraint matching
    let intentMatchScore = 0;
    const priceNum = typeof prod.price === "number" ? prod.price : parseFloat(String(prod.price)) || 0;

    if (intentConstraints.maxPrice && priceNum <= intentConstraints.maxPrice) {
      intentMatchScore += 20;
    }
    if (intentConstraints.minPrice && priceNum >= intentConstraints.minPrice) {
      intentMatchScore += 10;
    }
    if (intentConstraints.brand && prod.brand?.toLowerCase() === intentConstraints.brand.toLowerCase()) {
      intentMatchScore += 25;
    }
    if (intentConstraints.categoryId && prod.categoryId === intentConstraints.categoryId) {
      intentMatchScore += 25;
    }

    // 2. Behavioral interest score
    let behaviorScore = scores.productInterestScores[prod.id] || 0;
    if (prod.categoryId && scores.categoryInterestScores[prod.categoryId]) {
      behaviorScore += scores.categoryInterestScores[prod.categoryId] * 0.5;
    }
    if (prod.brand && scores.brandInterestScores[prod.brand]) {
      behaviorScore += scores.brandInterestScores[prod.brand] * 0.5;
    }

    // Boost if already viewed but not purchased
    if (productsViewed.includes(prod.id)) {
      behaviorScore += 5;
    }

    // 3. Explicit & Inferred preference matching
    let preferenceMatchScore = 0;

    // Check color / brand / category against preferences
    for (const pref of Object.values(explicitPreferences || {})) {
      if (pref.key === "brand" && prod.brand?.toLowerCase() === pref.value.toLowerCase()) {
        preferenceMatchScore += 30;
      }
      if (pref.key === "color" && JSON.stringify(prod.attributes || {}).toLowerCase().includes(pref.value.toLowerCase())) {
        preferenceMatchScore += 30;
      }
    }

    for (const pref of Object.values(inferredPreferences || {})) {
      if (pref.confidence >= 0.6) {
        if (pref.key === "brand" && prod.brand?.toLowerCase() === pref.value.toLowerCase()) {
          preferenceMatchScore += 15 * pref.confidence;
        }
        if (pref.key === "color" && JSON.stringify(prod.attributes || {}).toLowerCase().includes(pref.value.toLowerCase())) {
          preferenceMatchScore += 15 * pref.confidence;
        }
      }
    }

    // 4. Cart complement score
    const cartComplementScore = 0; // extendable for cross-sell scoring

    const finalRankScore =
      baseRelevanceScore +
      intentMatchScore +
      behaviorScore * 2 +
      preferenceMatchScore +
      cartComplementScore;

    return {
      productId: prod.id,
      baseRelevanceScore,
      intentMatchScore,
      behaviorScore,
      preferenceMatchScore,
      cartComplementScore,
      finalRankScore: Math.round(finalRankScore * 10) / 10,
    };
  });

  return ranked.sort((a, b) => b.finalRankScore - a.finalRankScore);
}

export function recordOutcomeFeedback(feedback: OutcomeFeedback): void {
  outcomeFeedbackStore.push(feedback);
}

export function getOutcomeFeedbackStore(): OutcomeFeedback[] {
  return [...outcomeFeedbackStore];
}

import {
  RankingWeights,
  ProductFeatureVector,
  RankedProduct,
  MerchantRule,
  DEFAULT_RANKING_WEIGHTS,
} from "./types";
import { FeatureStore } from "./featureStore";

export interface CandidateItem {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  similarity: number;
  inStock?: boolean;
  [key: string]: any;
}

export interface RankOptions {
  intentKey?: string;
  userPreferences?: string[];
  merchantRules?: MerchantRule[];
  weights?: RankingWeights;
  explorationRate?: number; // 0.0 to 1.0 (default 0.1)
  limit?: number;
}

/**
 * Product Ranking Engine (E2 + E11 + E12 + E13 + E14 + E17 + E18)
 * Implements deterministic candidate generation, filtering, feature calculation,
 * composite scoring, exploration (epsilon-greedy), cold-start fallback, and merchant rule enforcement.
 */
export class RankingEngine {
  /**
   * Rank a list of candidate products for an organization.
   */
  public static async rankCandidates<T extends CandidateItem>(
    orgId: string,
    candidates: T[],
    options?: RankOptions
  ): Promise<RankedProduct<T>[]> {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    const weights = options?.weights || (await FeatureStore.getActiveWeights(orgId));
    const merchantRules = options?.merchantRules || [];
    const explorationRate = options?.explorationRate ?? 0.1;

    // 1. Filtering & Hierarchy (E18 — Business Rules & Inventory)
    const eligibleCandidates = candidates.filter((candidate) => {
      // Inventory check (unless clearance mode rule allows out of stock)
      if (candidate.inStock === false) {
        return false;
      }

      // Check merchant EXCLUDE rule
      const isExcluded = merchantRules.some(
        (r) => r.type === "EXCLUDE" && (r.productId === candidate.id || r.categoryId === candidate.category)
      );
      if (isExcluded) return false;

      // Check MIN_PRICE / MAX_PRICE rule
      for (const rule of merchantRules) {
        if (rule.type === "MIN_PRICE" && rule.priceLimit !== undefined && candidate.price < rule.priceLimit) {
          return false;
        }
        if (rule.type === "MAX_PRICE" && rule.priceLimit !== undefined && candidate.price > rule.priceLimit) {
          return false;
        }
      }

      return true;
    });

    if (eligibleCandidates.length === 0) {
      return [];
    }

    // 2. Feature Generation & Scoring for each candidate
    const scoredList: Array<{ candidate: T; score: number; breakdown: Record<string, number>; isPinned: boolean }> =
      [];

    for (const candidate of eligibleCandidates) {
      let featureVector: ProductFeatureVector;
      try {
        featureVector = await FeatureStore.getProductFeatureVector(orgId, candidate.id, candidate.similarity, {
          intentKey: options?.intentKey,
          userPreferences: options?.userPreferences,
          merchantRules,
        });
      } catch (err) {
        // Cold start product fallback if DB query fails or product missing
        featureVector = {
          productId: candidate.id,
          name: candidate.name,
          price: candidate.price,
          category: candidate.category || null,
          inStock: true,
          semanticSimilarity: candidate.similarity,
          historicalCtr: 0,
          historicalCartRate: 0,
          historicalConversionRate: 0,
          returnRate: 0,
          intentConversionRate: 0,
          userPreferenceMatch: 0,
          isMerchantPinned: false,
          merchantBoostFactor: 1.0,
        };
      }

      const { score, breakdown } = this.calculateScore(featureVector, weights);

      scoredList.push({
        candidate,
        score,
        breakdown,
        isPinned: featureVector.isMerchantPinned,
      });
    }

    // 3. Sort candidates: Pinned products first (E18), then by descending score
    scoredList.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.score - a.score;
    });

    // 4. Exploration vs Exploitation (E14 — Epsilon Greedy)
    const result: RankedProduct<T>[] = scoredList.map((item) => ({
      productId: item.candidate.id,
      score: item.score,
      breakdown: item.breakdown,
      isExploration: false,
      item: item.candidate,
    }));

    if (explorationRate > 0 && result.length > 2) {
      const shouldExplore = Math.random() < explorationRate;
      if (shouldExplore) {
        // Swap slot 1 or 2 with a promising lower-ranked candidate
        const randomIndex = Math.floor(Math.random() * (result.length - 2)) + 2;
        const exploreItem = result[randomIndex];
        exploreItem.isExploration = true;

        // Swap into slot 1
        result[randomIndex] = result[1];
        result[1] = exploreItem;
      }
    }

    const limit = options?.limit || result.length;
    return result.slice(0, limit);
  }

  /**
   * Calculate composite ranking score and breakdown.
   */
  public static calculateScore(
    fv: ProductFeatureVector,
    weights: RankingWeights
  ): { score: number; breakdown: Record<string, number> } {
    // E13: Cold Start Product Detection (no historical impressions or conversion)
    const isColdStartProduct =
      fv.historicalCtr === 0 && fv.historicalConversionRate === 0 && fv.intentConversionRate === 0;

    let score = 0;
    const breakdown: Record<string, number> = {};

    if (isColdStartProduct) {
      // Cold start fallback formula: rely heavily on semantic similarity + user preference + merchant boost
      const simScore = fv.semanticSimilarity * 0.6;
      const prefScore = fv.userPreferenceMatch * 0.4;
      score = (simScore + prefScore) * fv.merchantBoostFactor;

      breakdown["cold_start_semantic"] = simScore;
      breakdown["cold_start_preference"] = prefScore;
      breakdown["merchant_boost"] = fv.merchantBoostFactor;
    } else {
      // Full adaptive formula (E2)
      const simComp = fv.semanticSimilarity * weights.semanticSimilarity;
      const intentComp = fv.intentConversionRate * weights.intentMatch;
      const prefComp = fv.userPreferenceMatch * weights.behavioralRelevance;
      const convComp = fv.historicalConversionRate * weights.conversionProbability;
      const ctrComp = fv.historicalCtr * weights.historicalPerformance;
      const returnPenaltyComp = fv.returnRate * weights.returnPenalty;
      const merchantComp = (fv.merchantBoostFactor - 1.0) * weights.merchantPreferences;

      score = simComp + intentComp + prefComp + convComp + ctrComp + merchantComp - returnPenaltyComp;

      breakdown["semantic"] = Number(simComp.toFixed(4));
      breakdown["intent"] = Number(intentComp.toFixed(4));
      breakdown["preference"] = Number(prefComp.toFixed(4));
      breakdown["conversion"] = Number(convComp.toFixed(4));
      breakdown["ctr"] = Number(ctrComp.toFixed(4));
      breakdown["merchant"] = Number(merchantComp.toFixed(4));
      breakdown["return_penalty"] = Number(returnPenaltyComp.toFixed(4));
    }

    return { score: Number(score.toFixed(4)), breakdown };
  }
}

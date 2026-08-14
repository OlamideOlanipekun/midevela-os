import prisma from "@/lib/prisma";
import { ProductFeatureVector, RankingWeights, DEFAULT_RANKING_WEIGHTS } from "./types";

export interface FeatureStoreFetchOptions {
  intentKey?: string;
  userPreferences?: string[];
  merchantRules?: Array<{
    type: string;
    productId?: string;
    factor?: number;
  }>;
}

function withDbTimeout<T>(promise: Promise<T>, timeoutMs = 150): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("DB Timeout")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Feature Store (E21)
 * Decouples real-time ranking requests from raw production transaction logs.
 * Provides normalized feature vectors and cached performance statistics.
 */
export class FeatureStore {
  /**
   * Fetch feature vector for a product with tenant isolation.
   */
  public static async getProductFeatureVector(
    orgId: string,
    productId: string,
    semanticSimilarity: number,
    options?: FeatureStoreFetchOptions
  ): Promise<ProductFeatureVector> {
    let product: any = null;
    let perfMetric: any = null;
    let intentPerf: any = null;

    try {
      [product, perfMetric, intentPerf] = await withDbTimeout(
        Promise.all([
          prisma.product.findFirst({
            where: { id: productId, orgId },
            select: { id: true, name: true, price: true, category: { select: { name: true } }, inventoryStatus: true },
          }),
          prisma.productPerformanceMetric.findUnique({
            where: { orgId_productId: { orgId, productId } },
          }),
          options?.intentKey
            ? prisma.intentProductPerformance.findUnique({
                where: { orgId_intentKey_productId: { orgId, intentKey: options.intentKey, productId } },
              })
            : Promise.resolve(null),
        ])
      );
    } catch {
      // Graceful fallback for offline/test environments without active DB
    }

    const inStock = product ? product.inventoryStatus === "IN_STOCK" : true;
    const priceNum = product ? Number(product.price) : 0;
    const categoryName = product?.category?.name ?? null;

    // Preference matching score
    let userPreferenceMatch = 0;
    if (options?.userPreferences && options.userPreferences.length > 0) {
      const lowerCategory = (categoryName || "").toLowerCase();
      const lowerName = (product?.name || "").toLowerCase();
      const matchCount = options.userPreferences.filter(
        (pref) => lowerCategory.includes(pref.toLowerCase()) || lowerName.includes(pref.toLowerCase())
      ).length;
      userPreferenceMatch = matchCount / options.userPreferences.length;
    }

    // Merchant rule matching
    let isMerchantPinned = false;
    let merchantBoostFactor = 1.0;

    if (options?.merchantRules) {
      for (const rule of options.merchantRules) {
        if (rule.productId === productId) {
          if (rule.type === "PIN") {
            isMerchantPinned = true;
          } else if (rule.type === "BOOST") {
            merchantBoostFactor = rule.factor ?? 1.5;
          }
        }
      }
    }

    return {
      productId: product?.id ?? productId,
      name: product?.name ?? `Product ${productId}`,
      price: priceNum,
      category: categoryName,
      inStock,
      semanticSimilarity,
      historicalCtr: perfMetric?.ctr ?? 0,
      historicalCartRate: perfMetric?.cartRate ?? 0,
      historicalConversionRate: perfMetric?.conversionRate ?? 0,
      returnRate: perfMetric?.returnRate ?? 0,
      intentConversionRate: intentPerf?.conversionRate ?? 0,
      userPreferenceMatch,
      isMerchantPinned,
      merchantBoostFactor,
    };
  }

  /**
   * Get active production model weights for tenant. Falls back to DEFAULT_RANKING_WEIGHTS.
   */
  public static async getActiveWeights(orgId: string): Promise<RankingWeights> {
    try {
      const activeModel = await withDbTimeout(
        prisma.rankingModel.findFirst({
          where: { orgId, status: "PRODUCTION" },
          orderBy: { promotedAt: "desc" },
        })
      );

      if (!activeModel || !activeModel.weights || typeof activeModel.weights !== "object") {
        return DEFAULT_RANKING_WEIGHTS;
      }

      const w = activeModel.weights as Record<string, number>;
      return {
        semanticSimilarity: w.semanticSimilarity ?? DEFAULT_RANKING_WEIGHTS.semanticSimilarity,
        intentMatch: w.intentMatch ?? DEFAULT_RANKING_WEIGHTS.intentMatch,
        behavioralRelevance: w.behavioralRelevance ?? DEFAULT_RANKING_WEIGHTS.behavioralRelevance,
        conversionProbability: w.conversionProbability ?? DEFAULT_RANKING_WEIGHTS.conversionProbability,
        merchantPreferences: w.merchantPreferences ?? DEFAULT_RANKING_WEIGHTS.merchantPreferences,
        historicalPerformance: w.historicalPerformance ?? DEFAULT_RANKING_WEIGHTS.historicalPerformance,
        returnPenalty: w.returnPenalty ?? DEFAULT_RANKING_WEIGHTS.returnPenalty,
      };
    } catch {
      return DEFAULT_RANKING_WEIGHTS;
    }
  }
}

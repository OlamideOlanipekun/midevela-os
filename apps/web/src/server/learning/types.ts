export interface RankingWeights {
  semanticSimilarity: number;
  intentMatch: number;
  behavioralRelevance: number;
  conversionProbability: number;
  merchantPreferences: number;
  historicalPerformance: number;
  returnPenalty: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  semanticSimilarity: 0.35,
  intentMatch: 0.25,
  behavioralRelevance: 0.15,
  conversionProbability: 0.15,
  merchantPreferences: 0.10,
  historicalPerformance: 0.10,
  returnPenalty: 0.15,
};

export interface ProductFeatureVector {
  productId: string;
  name: string;
  price: number;
  category: string | null;
  inStock: boolean;
  semanticSimilarity: number;
  historicalCtr: number;
  historicalCartRate: number;
  historicalConversionRate: number;
  returnRate: number;
  intentConversionRate: number;
  userPreferenceMatch: number;
  isMerchantPinned: boolean;
  merchantBoostFactor: number;
}

export interface RankedProduct<T = any> {
  productId: string;
  score: number;
  breakdown: Record<string, number>;
  isExploration: boolean;
  item: T;
}

export type MerchantRuleType =
  | "PIN"
  | "BOOST"
  | "EXCLUDE"
  | "MIN_PRICE"
  | "MAX_PRICE"
  | "CLEARANCE_ONLY";

export interface MerchantRule {
  id: string;
  type: MerchantRuleType;
  productId?: string;
  categoryId?: string;
  factor?: number; // e.g. 1.5 for boost
  priceLimit?: number;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // 0 to 1 ratio
  rankingWeights?: Partial<RankingWeights>;
  recommendationCount?: number;
  promptStyle?: "concise" | "detailed" | "comparison_first";
}

export interface VariantMetrics {
  impressions: number;
  clicks: number;
  carts: number;
  purchases: number;
  revenue: number;
  ctr: number;
  conversionRate: number;
}

export interface ExperimentConfig {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description?: string;
  status: "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED";
  variants: ExperimentVariant[];
  metrics: Record<string, VariantMetrics>;
  startedAt?: Date | null;
  endedAt?: Date | null;
}

export interface ModelVersion {
  id: string;
  orgId: string;
  version: string;
  status: "CANDIDATE" | "PRODUCTION" | "ARCHIVED" | "ROLLED_BACK";
  weights: RankingWeights;
  metrics: {
    backtestConversionRate?: number;
    backtestCtr?: number;
    ndcg?: number;
    sampleSize?: number;
    [key: string]: number | undefined;
  };
  trainingWindowStart?: Date | null;
  trainingWindowEnd?: Date | null;
  promotedAt?: Date | null;
}

export interface LearningSignalEvent {
  orgId: string;
  sessionId: string;
  customerId?: string;
  eventType:
    | "recommendation.impression"
    | "recommendation.click"
    | "recommendation.ignored"
    | "cart.add"
    | "cart.remove"
    | "checkout.start"
    | "checkout.abandon"
    | "purchase.complete"
    | "order.return";
  productId?: string;
  intentKey?: string;
  conversationTopic?: string;
  metadata?: Record<string, any>;
}

export interface LearningDashboardOverview {
  aiInfluencedRevenue: number;
  conversionRateImprovementPct: number;
  recommendationCtrPct: number;
  addToCartRatePct: number;
  topIntents: Array<{
    intentKey: string;
    impressions: number;
    purchases: number;
    conversionRatePct: number;
  }>;
  learningInsights: Array<{
    id: string;
    category: "PRODUCT" | "INTENT" | "CONVERSATION" | "EXPERIMENT";
    title: string;
    description: string;
    impact: string;
    positive: boolean;
  }>;
  activeExperiments: number;
  activeModelVersion: string;
}

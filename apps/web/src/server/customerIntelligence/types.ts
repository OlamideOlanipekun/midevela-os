/**
 * Milestone D — Customer Intelligence & Behavioral Engine Types
 */

export type IntentStage = "INITIAL" | "REFINED" | "CONSTRAINED" | "DECISION";

export type JourneyState =
  | "DISCOVERY"
  | "EXPLORATION"
  | "COMPARISON"
  | "DECISION"
  | "CART"
  | "CHECKOUT"
  | "PURCHASE";

export type BehavioralEventType =
  | "PAGE_VIEW"
  | "SEARCH"
  | "FILTER"
  | "PRODUCT_VIEW"
  | "PRODUCT_CLICK"
  | "PRODUCT_COMPARE"
  | "PRODUCT_RECOMMENDED"
  | "PRODUCT_ADDED"
  | "PRODUCT_REMOVED"
  | "CART_VIEWED"
  | "CHECKOUT_STARTED"
  | "CHECKOUT_ABANDONED"
  | "PURCHASE";

export type CustomerSegment =
  | "NEW_VISITOR"
  | "RETURNING_SHOPPER"
  | "HIGH_INTENT"
  | "PRICE_SENSITIVE"
  | "CATEGORY_ENTHUSIAST"
  | "FREQUENT_BUYER"
  | "CART_ABANDONER";

export type AbandonmentReason =
  | "PRICE_CONCERN"
  | "SHIPPING_CONCERN"
  | "PRODUCT_UNCERTAINTY"
  | "PAYMENT_FRICTION"
  | "VARIANT_UNCERTAINTY"
  | "LOW_INTENT"
  | "UNKNOWN";

export interface IntentConstraints {
  categoryId?: string;
  categoryName?: string;
  productType?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  color?: string;
  style?: string;
  brand?: string;
  useCase?: string;
  attributes?: Record<string, string>;
}

export interface ExplicitPreference {
  key: string;
  value: string;
  confidence: 1.0;
  source: "SHOPPER_STATEMENT";
  updatedAt: string;
}

export interface InferredPreference {
  key: string;
  value: string;
  confidence: number; // 0.0 to 0.95 (never 1.0 without explicit confirmation)
  evidenceCount: number;
  source: "BEHAVIORAL_INFERENCE";
  updatedAt: string;
}

export interface BehavioralScores {
  purchaseIntentScore: number;
  cartIntentScore: number;
  comparisonIntentScore: number;
  productInterestScores: Record<string, number>; // productId -> score
  categoryInterestScores: Record<string, number>; // categoryId -> score
  brandInterestScores: Record<string, number>; // brandName -> score
}

export interface PageContext {
  pageUrl?: string;
  pageType?: string;
  activeProductId?: string;
  activeCategoryId?: string;
  activeCategoryName?: string;
  selectedVariantId?: string;
  searchQuery?: string;
}

export interface ShopperSessionState {
  id: string;
  orgId: string;
  sessionId: string;
  customerId?: string | null;
  isAnonymous: boolean;
  journeyState: JourneyState;
  intentStage: IntentStage;
  currentIntent: string;
  intentConstraints: IntentConstraints;
  scores: BehavioralScores;
  explicitPreferences: Record<string, ExplicitPreference>;
  inferredPreferences: Record<string, InferredPreference>;
  categoriesViewed: string[];
  productsViewed: string[];
  productsCompared: string[];
  shortlist: string[];
  pageContext: PageContext;
  segment: CustomerSegment;
  lastActivityAt: string;
  createdAt: string;
  expiresAt?: string | null;
}

export interface BehavioralEventPayload {
  orgId: string;
  sessionId: string;
  customerId?: string;
  eventType: BehavioralEventType;
  pageUrl?: string;
  productId?: string;
  categoryId?: string;
  brand?: string;
  searchQuery?: string;
  filterConstraints?: Partial<IntentConstraints>;
  comparedProductIds?: string[];
  cartItemCount?: number;
  cartTotalValue?: number;
  metadata?: Record<string, any>;
}

export interface AbandonmentHypothesis {
  cartId?: string;
  sessionId: string;
  customerId?: string;
  cartValue: number;
  itemCount: number;
  reason: AbandonmentReason;
  confidence: number; // 0.0 - 1.0
  evidence: string[];
  journeyPath: string[]; // e.g. ["PRODUCT_VIEW", "PRODUCT_COMPARE", "PRODUCT_ADDED", "CHECKOUT_STARTED"]
}

export interface ContextualRecoveryPlan {
  hypothesis: AbandonmentHypothesis;
  eligible: boolean;
  recoveryStrategy: string;
  suggestedMessage: string;
  recommendedActions: string[];
}

export interface SmartConversationMemory {
  intent: string;
  intentStage: IntentStage;
  constraints: IntentConstraints;
  shortlist: string[];
  currentProduct?: string;
  currentCart?: {
    itemCount: number;
    totalAmount: number;
    productIds: string[];
  };
  importantPreferences: {
    explicit: Record<string, string>;
    inferred: Record<string, { value: string; confidence: number }>;
  };
  openQuestions: string[];
  journeyState: JourneyState;
  segment: CustomerSegment;
}

export interface PersonalizedRankingFactors {
  productId: string;
  baseRelevanceScore: number;
  intentMatchScore: number;
  behaviorScore: number;
  preferenceMatchScore: number;
  cartComplementScore: number;
  finalRankScore: number;
}

export interface OutcomeFeedback {
  recommendationId: string;
  productId: string;
  sessionId: string;
  orgId: string;
  shown: boolean;
  clicked: boolean;
  addedToCart: boolean;
  purchased: boolean;
  timestamp: string;
}

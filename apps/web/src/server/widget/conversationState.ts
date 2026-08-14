export type ConversationGoal =
  | "WELCOME"
  | "DISCOVERY"
  | "QUALIFICATION"
  | "RECOMMENDATION"
  | "PRODUCT_DETAILS"
  | "COMPARE"
  | "DECISION"
  | "BUSINESS_SUPPORT"
  | "OBJECTION"
  | "CHECKOUT"
  | "ESCALATION"
  | "GENERAL_CHAT";

export type ConversationMode =
  | "DISCOVERY"
  | "QUALIFICATION"
  | "RECOMMENDATION"
  | "PRODUCT_DETAILS"
  | "COMPARE"
  | "GENERAL_CHAT";

/**
 * Accumulated shopping constraints — merged across conversation turns (B4).
 * Every turn contributes new constraints; nothing is lost unless the shopper
 * explicitly starts a new journey.
 */
export interface AccumulatedConstraints {
  categoryId?: string;
  categoryName?: string;
  maxPrice?: number;
  minPrice?: number;
  color?: string;
  style?: string;
  brand?: string;
  useCase?: string;
  /** Extra key-value attributes from qualification answers */
  answers?: Record<string, string>;
  [key: string]: unknown;
}

export interface ConversationState {
  mode: ConversationMode;

  /** Current sales goal — the high-level purpose of the conversation */
  goal?: ConversationGoal;

  categoryId?: string;
  categoryName?: string;

  productType?: string;

  budget?: {
    min?: number;
    max?: number;
  };

  recommendedProducts?: string[];

  activeProductId?: string;

  comparedProducts?: string[];

  /** What the assistant is actively waiting for from the shopper */
  waitingFor?: string;

  pendingQuestion?: string;

  lastAssistantAction?: string;

  // ── Sales Memory ─────────────────────────────────────────────────────
  /** Known information keyed by question type, e.g. { skinType: "dry", concern: "acne" } */
  knownInformation?: Record<string, string>;

  /** Questions still needing answers, e.g. ["budget", "skinType"] */
  missingInformation?: string[];

  /** Questions already answered this session */
  answeredQuestions?: string[];

  /** Short summary of the conversation so far */
  conversationSummary?: string;

  /** Next best action to suggest to the shopper */
  nextBestAction?: string;

  /** Last business topic discussed (for BUSINESS_SUPPORT) */
  lastBusinessTopic?: string;

  // ── Milestone B additions ─────────────────────────────────────────────

  /**
   * Cumulative shopping constraints merged across ALL turns (B4).
   * Hard constraints (maxPrice, category, color) persist through refinement.
   * Reset only on NEW_SHOPPING_JOURNEY.
   */
  accumulatedConstraints?: AccumulatedConstraints;

  /**
   * Active shortlist of product IDs the shopper is considering (B9).
   * Supports:
   *   "Keep the first one", "Remove the expensive one", "Compare the remaining two"
   */
  shortlistProductIds?: string[];

  /**
   * The product on the page the shopper is currently viewing (B11).
   * Grounds implicit references: "Is this available in size 42?"
   */
  activePageProductId?: string;

  /** Category of the page currently being viewed (B11 current-page intelligence) */
  activePageCategoryId?: string;
  activePageCategoryName?: string;
}

export function createInitialState(): ConversationState {
  return { mode: "DISCOVERY" };
}

export function resetShoppingState(state: ConversationState): ConversationState {
  return {
    mode: "DISCOVERY",
  };
}

export function transitionTo(
  state: ConversationState,
  overrides: Partial<ConversationState>,
): ConversationState {
  return { ...state, ...overrides };
}

/**
 * Merge new constraints into the accumulated constraint set (B4).
 * Incoming constraints win (shopper may change their mind).
 * Undefined incoming values leave the existing value intact.
 */
export function mergeConstraints(
  existing: AccumulatedConstraints | undefined,
  incoming: Partial<AccumulatedConstraints>,
): AccumulatedConstraints {
  const merged: AccumulatedConstraints = { ...(existing ?? {}) };

  if (incoming.categoryId !== undefined) merged.categoryId = incoming.categoryId;
  if (incoming.categoryName !== undefined) merged.categoryName = incoming.categoryName;
  if (incoming.maxPrice !== undefined) merged.maxPrice = incoming.maxPrice;
  if (incoming.minPrice !== undefined) merged.minPrice = incoming.minPrice;
  if (incoming.color !== undefined) merged.color = incoming.color;
  if (incoming.style !== undefined) merged.style = incoming.style;
  if (incoming.brand !== undefined) merged.brand = incoming.brand;
  if (incoming.useCase !== undefined) merged.useCase = incoming.useCase;
  if (incoming.answers && Object.keys(incoming.answers).length > 0) {
    merged.answers = { ...(merged.answers ?? {}), ...incoming.answers };
  }

  return merged;
}

// ── Shortlist management (B9) ─────────────────────────────────────────────

/** Add a product to the shortlist. Deduplicates automatically. */
export function addToShortlist(
  state: ConversationState,
  productId: string,
): ConversationState {
  const list = state.shortlistProductIds ?? [];
  if (list.includes(productId)) return state;
  return { ...state, shortlistProductIds: [...list, productId] };
}

/** Remove a product from the shortlist by ID. */
export function removeFromShortlist(
  state: ConversationState,
  productId: string,
): ConversationState {
  return {
    ...state,
    shortlistProductIds: (state.shortlistProductIds ?? []).filter((id) => id !== productId),
  };
}

/** Keep only the specified product IDs in the shortlist. */
export function keepInShortlist(
  state: ConversationState,
  productIds: string[],
): ConversationState {
  const set = new Set(productIds);
  return {
    ...state,
    shortlistProductIds: (state.shortlistProductIds ?? []).filter((id) => set.has(id)),
  };
}

/** Clear the shortlist entirely. */
export function clearShortlist(state: ConversationState): ConversationState {
  return { ...state, shortlistProductIds: [] };
}

/** Convert ConversationState to the flat context shape stored in DB */
export function stateToContext(state: ConversationState): Record<string, unknown> {
  return {
    mode: state.mode,
    ...(state.goal ? { goal: state.goal } : {}),
    ...(state.categoryId ? { categoryId: state.categoryId } : {}),
    ...(state.categoryName ? { categoryName: state.categoryName } : {}),
    ...(state.productType ? { productType: state.productType } : {}),
    ...(state.budget ? { budgetMin: state.budget.min, budgetMax: state.budget.max } : {}),
    ...(state.recommendedProducts?.length ? { recommendedProducts: state.recommendedProducts } : {}),
    ...(state.activeProductId ? { activeProductId: state.activeProductId } : {}),
    ...(state.comparedProducts?.length ? { comparedProducts: state.comparedProducts } : {}),
    ...(state.waitingFor ? { waitingFor: state.waitingFor } : {}),
    ...(state.pendingQuestion ? { pendingQuestion: state.pendingQuestion } : {}),
    ...(state.lastAssistantAction ? { lastAssistantAction: state.lastAssistantAction } : {}),
    ...(state.conversationSummary ? { conversationSummary: state.conversationSummary } : {}),
    ...(state.nextBestAction ? { nextBestAction: state.nextBestAction } : {}),
    ...(state.lastBusinessTopic ? { lastBusinessTopic: state.lastBusinessTopic } : {}),
    ...(state.knownInformation && Object.keys(state.knownInformation).length > 0
      ? { knownInformation: state.knownInformation }
      : {}),
    ...(state.missingInformation?.length ? { missingInformation: state.missingInformation } : {}),
    ...(state.answeredQuestions?.length ? { answeredQuestions: state.answeredQuestions } : {}),
    // Milestone B
    ...(state.accumulatedConstraints && Object.keys(state.accumulatedConstraints).length > 0
      ? { accumulatedConstraints: state.accumulatedConstraints }
      : {}),
    ...(state.shortlistProductIds?.length ? { shortlistProductIds: state.shortlistProductIds } : {}),
    ...(state.activePageProductId ? { activePageProductId: state.activePageProductId } : {}),
    ...(state.activePageCategoryId ? { activePageCategoryId: state.activePageCategoryId } : {}),
    ...(state.activePageCategoryName ? { activePageCategoryName: state.activePageCategoryName } : {}),
  };
}

const VALID_MODES: ConversationMode[] = [
  "DISCOVERY", "QUALIFICATION", "RECOMMENDATION", "PRODUCT_DETAILS", "COMPARE", "GENERAL_CHAT",
];

const VALID_GOALS: ConversationGoal[] = [
  "WELCOME", "DISCOVERY", "QUALIFICATION", "RECOMMENDATION", "PRODUCT_DETAILS", "COMPARE",
  "DECISION", "BUSINESS_SUPPORT", "OBJECTION", "CHECKOUT", "ESCALATION", "GENERAL_CHAT",
];

/** Parse ConversationState from the flat context shape stored in DB */
export function contextToState(context: Record<string, unknown>): ConversationState {
  const mode = (typeof context.mode === "string" && VALID_MODES.includes(context.mode as ConversationMode))
    ? (context.mode as ConversationMode)
    : "DISCOVERY";

  const budgetMin = typeof context.budgetMin === "number" ? context.budgetMin : undefined;
  const budgetMax = typeof context.budgetMax === "number" ? context.budgetMax : undefined;

  return {
    mode,
    goal: (typeof context.goal === "string" && VALID_GOALS.includes(context.goal as ConversationGoal))
      ? (context.goal as ConversationGoal)
      : undefined,
    categoryId: typeof context.categoryId === "string" ? context.categoryId : undefined,
    categoryName: typeof context.categoryName === "string" ? context.categoryName : undefined,
    productType: typeof context.productType === "string" ? context.productType : undefined,
    budget:
      budgetMin !== undefined || budgetMax !== undefined
        ? {
            ...(budgetMin !== undefined ? { min: budgetMin } : {}),
            ...(budgetMax !== undefined ? { max: budgetMax } : {}),
          }
        : undefined,
    recommendedProducts: Array.isArray(context.recommendedProducts)
      ? context.recommendedProducts.map(String)
      : undefined,
    activeProductId: typeof context.activeProductId === "string" ? context.activeProductId : undefined,
    comparedProducts: Array.isArray(context.comparedProducts)
      ? context.comparedProducts.map(String)
      : undefined,
    waitingFor: typeof context.waitingFor === "string" ? context.waitingFor : undefined,
    pendingQuestion: typeof context.pendingQuestion === "string" ? context.pendingQuestion : undefined,
    lastAssistantAction: typeof context.lastAssistantAction === "string" ? context.lastAssistantAction : undefined,
    conversationSummary: typeof context.conversationSummary === "string" ? context.conversationSummary : undefined,
    nextBestAction: typeof context.nextBestAction === "string" ? context.nextBestAction : undefined,
    lastBusinessTopic: typeof context.lastBusinessTopic === "string" ? context.lastBusinessTopic : undefined,
    knownInformation:
      typeof context.knownInformation === "object" && context.knownInformation !== null
        ? (context.knownInformation as Record<string, string>)
        : undefined,
    missingInformation: Array.isArray(context.missingInformation)
      ? context.missingInformation.map(String)
      : undefined,
    answeredQuestions: Array.isArray(context.answeredQuestions)
      ? context.answeredQuestions.map(String)
      : undefined,
    // Milestone B
    accumulatedConstraints:
      typeof context.accumulatedConstraints === "object" && context.accumulatedConstraints !== null
        ? (context.accumulatedConstraints as AccumulatedConstraints)
        : undefined,
    shortlistProductIds: Array.isArray(context.shortlistProductIds)
      ? context.shortlistProductIds.map(String)
      : undefined,
    activePageProductId:
      typeof context.activePageProductId === "string" ? context.activePageProductId : undefined,
    activePageCategoryId:
      typeof context.activePageCategoryId === "string" ? context.activePageCategoryId : undefined,
    activePageCategoryName:
      typeof context.activePageCategoryName === "string" ? context.activePageCategoryName : undefined,
  };
}

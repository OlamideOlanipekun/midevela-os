export type ConversationGoal =
  | "WELCOME"
  | "DISCOVERY"
  | "QUALIFICATION"
  | "RECOMMENDATION"
  | "PRODUCT_DETAILS"
  | "COMPARE"
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
  };
}

/** Parse ConversationState from the flat context shape stored in DB */
export function contextToState(context: Record<string, unknown>): ConversationState {
  const mode = (typeof context.mode === "string" &&
    ["DISCOVERY", "QUALIFICATION", "RECOMMENDATION", "PRODUCT_DETAILS", "COMPARE", "GENERAL_CHAT"].includes(context.mode))
    ? (context.mode as ConversationMode)
    : "DISCOVERY";

  const budgetMin = typeof context.budgetMin === "number" ? context.budgetMin : undefined;
  const budgetMax = typeof context.budgetMax === "number" ? context.budgetMax : undefined;

  return {
    mode,
    goal: (typeof context.goal === "string" &&
      ["WELCOME", "DISCOVERY", "QUALIFICATION", "RECOMMENDATION", "PRODUCT_DETAILS", "COMPARE", "BUSINESS_SUPPORT", "OBJECTION", "CHECKOUT", "ESCALATION", "GENERAL_CHAT"].includes(context.goal))
      ? (context.goal as ConversationGoal)
      : undefined,
    categoryId: typeof context.categoryId === "string" ? context.categoryId : undefined,
    categoryName: typeof context.categoryName === "string" ? context.categoryName : undefined,
    productType: typeof context.productType === "string" ? context.productType : undefined,
    budget: budgetMin !== undefined || budgetMax !== undefined
      ? { ...(budgetMin !== undefined ? { min: budgetMin } : {}), ...(budgetMax !== undefined ? { max: budgetMax } : {}) }
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
    knownInformation: typeof context.knownInformation === "object" && context.knownInformation !== null
      ? (context.knownInformation as Record<string, string>)
      : undefined,
    missingInformation: Array.isArray(context.missingInformation)
      ? context.missingInformation.map(String)
      : undefined,
    answeredQuestions: Array.isArray(context.answeredQuestions)
      ? context.answeredQuestions.map(String)
      : undefined,
  };
}

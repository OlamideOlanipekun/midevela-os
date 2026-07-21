export type ConversationMode =
  | "DISCOVERY"
  | "QUALIFICATION"
  | "RECOMMENDATION"
  | "PRODUCT_DETAILS"
  | "COMPARE"
  | "GENERAL_CHAT";

export interface ConversationState {
  mode: ConversationMode;

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

  pendingQuestion?: string;

  lastAssistantAction?: string;
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
    ...(state.categoryId ? { categoryId: state.categoryId } : {}),
    ...(state.categoryName ? { categoryName: state.categoryName } : {}),
    ...(state.productType ? { productType: state.productType } : {}),
    ...(state.budget ? { budgetMin: state.budget.min, budgetMax: state.budget.max } : {}),
    ...(state.recommendedProducts?.length ? { recommendedProducts: state.recommendedProducts } : {}),
    ...(state.activeProductId ? { activeProductId: state.activeProductId } : {}),
    ...(state.comparedProducts?.length ? { comparedProducts: state.comparedProducts } : {}),
    ...(state.pendingQuestion ? { pendingQuestion: state.pendingQuestion } : {}),
    ...(state.lastAssistantAction ? { lastAssistantAction: state.lastAssistantAction } : {}),
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
    pendingQuestion: typeof context.pendingQuestion === "string" ? context.pendingQuestion : undefined,
    lastAssistantAction: typeof context.lastAssistantAction === "string" ? context.lastAssistantAction : undefined,
  };
}

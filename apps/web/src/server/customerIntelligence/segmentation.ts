import { CustomerSegment, ShopperSessionState } from "./types";

export function evaluateCustomerSegment(
  sessionState: ShopperSessionState,
  pastPurchaseCount = 0,
  hasAbandonedCart = false
): CustomerSegment {
  if (pastPurchaseCount >= 2) {
    return "FREQUENT_BUYER";
  }

  if (hasAbandonedCart || sessionState.journeyState === "CART") {
    return "CART_ABANDONER";
  }

  if (sessionState.scores.purchaseIntentScore >= 15 || sessionState.scores.cartIntentScore >= 10) {
    return "HIGH_INTENT";
  }

  if (
    sessionState.intentConstraints.maxPrice ||
    Object.values(sessionState.explicitPreferences).some((p) => p.key === "price" || p.key === "budget")
  ) {
    return "PRICE_SENSITIVE";
  }

  if (sessionState.categoriesViewed.length >= 1) {
    return "CATEGORY_ENTHUSIAST";
  }

  if (!sessionState.isAnonymous) {
    return "RETURNING_SHOPPER";
  }

  return "NEW_VISITOR";
}

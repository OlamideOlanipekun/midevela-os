import {
  AbandonmentReason,
  AbandonmentHypothesis,
  ContextualRecoveryPlan,
  ShopperSessionState,
} from "./types";

export function analyzeAbandonmentJourney(
  sessionState: ShopperSessionState,
  events: Array<{ eventType: string; pageUrl?: string | null; metadata?: any }>,
  cartInfo: { cartId?: string; totalValue: number; itemCount: number }
): AbandonmentHypothesis {
  const journeyPath = events.map((e) => e.eventType);

  let reason: AbandonmentReason = "UNKNOWN";
  let confidence = 0.5;
  const evidence: string[] = [];

  const pageUrls = events.map((e) => (e.pageUrl || "").toLowerCase());
  const searchedTerms = events
    .filter((e) => e.eventType === "SEARCH")
    .map((e) => (e.metadata?.query || "").toLowerCase());

  const viewedShipping = pageUrls.some((url) => url.includes("shipping") || url.includes("delivery"));
  const viewedReturns = pageUrls.some((url) => url.includes("return") || url.includes("refund"));
  const comparedProducts = events.some((e) => e.eventType === "PRODUCT_COMPARE");
  const priceSearches = searchedTerms.some((q) => q.includes("cheap") || q.includes("discount") || q.includes("price") || q.includes("sale"));

  const checkoutEvents = events.filter((e) => e.eventType === "CHECKOUT_STARTED");
  const filterEvents = events.filter((e) => e.eventType === "FILTER");

  if (viewedShipping || searchedTerms.some((q) => q.includes("shipping") || q.includes("delivery"))) {
    reason = "SHIPPING_CONCERN";
    confidence = 0.85;
    if (viewedShipping) evidence.push("Viewed shipping or delivery policy page");
    evidence.push("Inquired about shipping or delivery details during session");
    evidence.push("Abandoned cart after visiting checkout");
  } else if (comparedProducts || filterEvents.length >= 3) {
    reason = "PRODUCT_UNCERTAINTY";
    confidence = 0.78;
    if (comparedProducts) evidence.push("Compared multiple products in cart before exiting");
    if (filterEvents.length >= 3) evidence.push("Applied multiple filters seeking specific feature match");
    evidence.push("Did not select a final preferred variant");
  } else if (priceSearches || (sessionState.intentConstraints.maxPrice && cartInfo.totalValue > sessionState.intentConstraints.maxPrice)) {
    reason = "PRICE_CONCERN";
    confidence = 0.82;
    if (priceSearches) evidence.push("Searched for pricing/discount information");
    if (sessionState.intentConstraints.maxPrice && cartInfo.totalValue > sessionState.intentConstraints.maxPrice) {
      evidence.push(`Cart total (${cartInfo.totalValue}) exceeded specified budget limit (${sessionState.intentConstraints.maxPrice})`);
    }
  } else if (checkoutEvents.length > 0) {
    reason = "PAYMENT_FRICTION";
    confidence = 0.70;
    evidence.push("Started checkout process");
    evidence.push("Exited session at checkout step without completed order");
  } else if (events.length <= 3) {
    reason = "LOW_INTENT";
    confidence = 0.65;
    evidence.push("Minimal interaction history before cart exit");
  } else {
    reason = "UNKNOWN";
    confidence = 0.40;
    evidence.push("Cart exited without explicit concern signals detected");
  }

  return {
    cartId: cartInfo.cartId,
    sessionId: sessionState.sessionId,
    customerId: sessionState.customerId || undefined,
    cartValue: cartInfo.totalValue,
    itemCount: cartInfo.itemCount,
    reason,
    confidence,
    evidence,
    journeyPath,
  };
}

export function generateContextualRecovery(hypothesis: AbandonmentHypothesis): ContextualRecoveryPlan {
  let recoveryStrategy = "";
  let suggestedMessage = "";
  const recommendedActions: string[] = [];

  switch (hypothesis.reason) {
    case "SHIPPING_CONCERN":
      recoveryStrategy = "Provide clear delivery timeline & shipping cost information";
      suggestedMessage = "Still deciding? Delivery options and estimated arrival dates are available. Would you like details on shipping to your location?";
      recommendedActions.push("Show delivery estimates", "Explain free shipping thresholds");
      break;

    case "PRODUCT_UNCERTAINTY":
      recoveryStrategy = "Offer side-by-side feature comparison or recommendation summary";
      suggestedMessage = "You were looking at a few great options earlier! Would a quick comparison help you decide which one best fits your needs?";
      recommendedActions.push("Show product comparison", "Highlight key customer reviews");
      break;

    case "PRICE_CONCERN":
      recoveryStrategy = "Highlight product value, warranty, or budget-friendly alternative options";
      suggestedMessage = "Need help finding the right value? We can show you similar options within your target budget range.";
      recommendedActions.push("Show budget alternatives", "Highlight payment options");
      break;

    case "VARIANT_UNCERTAINTY":
      recoveryStrategy = "Assist with size, color, or specification selection";
      suggestedMessage = "Looking for a different size or color? Here are the currently available options in stock.";
      recommendedActions.push("Show available variant matrix", "Provide sizing guide");
      break;

    case "PAYMENT_FRICTION":
      recoveryStrategy = "Reassure payment options & offer direct assistance";
      suggestedMessage = "Notice you couldn't complete checkout! We support multiple secure payment options including cards and bank transfers.";
      recommendedActions.push("List supported payment channels", "Offer direct assistance");
      break;

    default:
      recoveryStrategy = "Gentle continuation prompt";
      suggestedMessage = "Welcome back! Would you like to pick up where you left off with your cart items?";
      recommendedActions.push("Resume cart session");
      break;
  }

  return {
    hypothesis,
    eligible: hypothesis.confidence >= 0.5 && hypothesis.itemCount > 0,
    recoveryStrategy,
    suggestedMessage,
    recommendedActions,
  };
}

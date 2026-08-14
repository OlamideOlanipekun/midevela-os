import { JourneyState, BehavioralEventType } from "./types";

export function evaluateJourneyState(
  currentState: JourneyState,
  eventType: BehavioralEventType,
  metadata?: Record<string, any>
): JourneyState {
  switch (eventType) {
    case "PURCHASE":
      return "PURCHASE";

    case "CHECKOUT_STARTED":
      return "CHECKOUT";

    case "CART_VIEWED":
    case "PRODUCT_ADDED":
      if (currentState === "CHECKOUT" || currentState === "PURCHASE") {
        return currentState;
      }
      return "CART";

    case "PRODUCT_COMPARE":
      if (currentState === "CART" || currentState === "CHECKOUT" || currentState === "PURCHASE") {
        return currentState;
      }
      return "COMPARISON";

    case "PRODUCT_VIEW":
    case "PRODUCT_CLICK":
      if (
        currentState === "COMPARISON" ||
        currentState === "CART" ||
        currentState === "CHECKOUT" ||
        currentState === "PURCHASE"
      ) {
        return currentState;
      }
      return "EXPLORATION";

    case "SEARCH":
    case "FILTER":
    case "PAGE_VIEW":
      if (currentState === "DISCOVERY") {
        return "EXPLORATION";
      }
      return currentState;

    default:
      return currentState;
  }
}

import { describe, it, expect } from "vitest";
import { evaluateJourneyState } from "../journeyEngine";

describe("Journey State Engine", () => {
  it("progresses journey state sequentially", () => {
    let state = evaluateJourneyState("DISCOVERY", "PAGE_VIEW");
    expect(state).toBe("EXPLORATION");

    state = evaluateJourneyState(state, "PRODUCT_VIEW");
    expect(state).toBe("EXPLORATION");

    state = evaluateJourneyState(state, "PRODUCT_COMPARE");
    expect(state).toBe("COMPARISON");

    state = evaluateJourneyState(state, "PRODUCT_ADDED");
    expect(state).toBe("CART");

    state = evaluateJourneyState(state, "CHECKOUT_STARTED");
    expect(state).toBe("CHECKOUT");

    state = evaluateJourneyState(state, "PURCHASE");
    expect(state).toBe("PURCHASE");
  });
});

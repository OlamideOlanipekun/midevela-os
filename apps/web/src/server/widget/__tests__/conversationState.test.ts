import { describe, it, expect } from "vitest";
import {
  createInitialState,
  resetShoppingState,
  transitionTo,
  stateToContext,
  contextToState,
} from "../conversationState";
import type { ConversationState } from "../conversationState";

describe("createInitialState", () => {
  it("returns DISCOVERY mode", () => {
    const state = createInitialState();
    expect(state.mode).toBe("DISCOVERY");
    expect(state.recommendedProducts).toBeUndefined();
  });
});

describe("resetShoppingState", () => {
  it("resets to DISCOVERY with no shopping data", () => {
    const state: ConversationState = {
      mode: "RECOMMENDATION",
      categoryId: "cat-1",
      categoryName: "Skincare",
      recommendedProducts: ["p1", "p2"],
      budget: { min: 0, max: 50000 },
    };
    const reset = resetShoppingState(state);
    expect(reset.mode).toBe("DISCOVERY");
    expect(reset.categoryId).toBeUndefined();
    expect(reset.recommendedProducts).toBeUndefined();
    expect(reset.budget).toBeUndefined();
  });
});

describe("transitionTo", () => {
  it("merges overrides into existing state", () => {
    const state = createInitialState();
    const updated = transitionTo(state, { mode: "RECOMMENDATION", categoryName: "Skincare" });
    expect(updated.mode).toBe("RECOMMENDATION");
    expect(updated.categoryName).toBe("Skincare");
    expect(updated.recommendedProducts).toBeUndefined();
  });
});

describe("stateToContext / contextToState round-trip", () => {
  it("preserves all fields through serialization", () => {
    const state: ConversationState = {
      mode: "RECOMMENDATION",
      categoryId: "cat-skincare",
      categoryName: "Skincare",
      productType: "serum",
      budget: { min: 0, max: 50000 },
      recommendedProducts: ["p1", "p2", "p3"],
      activeProductId: "p1",
      comparedProducts: ["p1", "p2"],
      pendingQuestion: "What's your budget?",
      lastAssistantAction: "recommended products",
    };

    const context = stateToContext(state);
    const restored = contextToState(context);

    expect(restored.mode).toBe("RECOMMENDATION");
    expect(restored.categoryId).toBe("cat-skincare");
    expect(restored.categoryName).toBe("Skincare");
    expect(restored.productType).toBe("serum");
    expect(restored.budget?.min).toBe(0);
    expect(restored.budget?.max).toBe(50000);
    expect(restored.recommendedProducts).toEqual(["p1", "p2", "p3"]);
    expect(restored.activeProductId).toBe("p1");
    expect(restored.comparedProducts).toEqual(["p1", "p2"]);
    expect(restored.pendingQuestion).toBe("What's your budget?");
    expect(restored.lastAssistantAction).toBe("recommended products");
  });

  it("handles empty state", () => {
    const state = createInitialState();
    const context = stateToContext(state);
    const restored = contextToState(context);
    expect(restored.mode).toBe("DISCOVERY");
    expect(restored.categoryName).toBeUndefined();
  });

  it("handles null context gracefully", () => {
    const restored = contextToState({});
    expect(restored.mode).toBe("DISCOVERY");
  });
});

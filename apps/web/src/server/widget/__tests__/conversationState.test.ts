import { describe, it, expect } from "vitest";
import {
  createInitialState,
  resetShoppingState,
  transitionTo,
  stateToContext,
  contextToState,
  mergeConstraints,
  addToShortlist,
  removeFromShortlist,
  keepInShortlist,
  clearShortlist,
} from "../conversationState";
import type { ConversationState, AccumulatedConstraints } from "../conversationState";

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

// ── Milestone B tests ───────────────────────────────────────────────────────

describe("mergeConstraints (B4)", () => {
  it("merges incoming over existing values", () => {
    const existing: AccumulatedConstraints = { maxPrice: 100000, color: "black" };
    const incoming = { maxPrice: 80000, style: "casual" };
    const result = mergeConstraints(existing, incoming);
    expect(result.maxPrice).toBe(80000);
    expect(result.color).toBe("black");
    expect(result.style).toBe("casual");
  });

  it("preserves existing values when incoming fields are undefined", () => {
    const existing: AccumulatedConstraints = { maxPrice: 100000, brand: "Nike" };
    const result = mergeConstraints(existing, {});
    expect(result.maxPrice).toBe(100000);
    expect(result.brand).toBe("Nike");
  });

  it("starts from empty when no existing constraints", () => {
    const result = mergeConstraints(undefined, { maxPrice: 50000, color: "white" });
    expect(result.maxPrice).toBe(50000);
    expect(result.color).toBe("white");
  });

  it("merges answers additively — new keys added, existing overwritten", () => {
    const existing: AccumulatedConstraints = { answers: { purpose: "running", skinType: "dry" } };
    const result = mergeConstraints(existing, { answers: { purpose: "casual", size: "42" } });
    expect(result.answers?.purpose).toBe("casual");
    expect(result.answers?.skinType).toBe("dry");
    expect(result.answers?.size).toBe("42");
  });
});

describe("Shortlist management (B9)", () => {
  const baseState: ConversationState = {
    mode: "RECOMMENDATION",
    shortlistProductIds: ["a", "b", "c"],
  };

  it("addToShortlist deduplicates", () => {
    const s = addToShortlist(baseState, "a");
    expect(s.shortlistProductIds).toEqual(["a", "b", "c"]);
  });

  it("addToShortlist adds new items", () => {
    const s = addToShortlist(baseState, "d");
    expect(s.shortlistProductIds).toContain("d");
    expect(s.shortlistProductIds?.length).toBe(4);
  });

  it("removeFromShortlist removes the correct item", () => {
    const s = removeFromShortlist(baseState, "b");
    expect(s.shortlistProductIds).toEqual(["a", "c"]);
  });

  it("keepInShortlist keeps only specified IDs", () => {
    const s = keepInShortlist(baseState, ["a", "c"]);
    expect(s.shortlistProductIds).toEqual(["a", "c"]);
  });

  it("clearShortlist empties the list", () => {
    const s = clearShortlist(baseState);
    expect(s.shortlistProductIds).toEqual([]);
  });
});

describe("Milestone B context round-trip", () => {
  it("round-trips accumulatedConstraints", () => {
    const state: ConversationState = {
      mode: "RECOMMENDATION",
      accumulatedConstraints: {
        maxPrice: 80000,
        color: "black",
        style: "casual",
        answers: { purpose: "running" },
      },
    };
    const ctx = stateToContext(state);
    const restored = contextToState(ctx);
    expect(restored.accumulatedConstraints?.maxPrice).toBe(80000);
    expect(restored.accumulatedConstraints?.color).toBe("black");
    expect(restored.accumulatedConstraints?.answers?.purpose).toBe("running");
  });

  it("round-trips shortlistProductIds", () => {
    const state: ConversationState = {
      mode: "RECOMMENDATION",
      shortlistProductIds: ["id1", "id2", "id3"],
    };
    const ctx = stateToContext(state);
    const restored = contextToState(ctx);
    expect(restored.shortlistProductIds).toEqual(["id1", "id2", "id3"]);
  });

  it("round-trips activePageProductId and activePageCategoryName", () => {
    const state: ConversationState = {
      mode: "PRODUCT_DETAILS",
      activePageProductId: "page-product-id",
      activePageCategoryName: "Sneakers",
    };
    const ctx = stateToContext(state);
    const restored = contextToState(ctx);
    expect(restored.activePageProductId).toBe("page-product-id");
    expect(restored.activePageCategoryName).toBe("Sneakers");
  });

  it("accepts and preserves the new DECISION goal", () => {
    const state: ConversationState = { mode: "COMPARE", goal: "DECISION" };
    const ctx = stateToContext(state);
    const restored = contextToState(ctx);
    expect(restored.goal).toBe("DECISION");
  });
});

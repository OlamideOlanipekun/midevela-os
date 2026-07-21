import { describe, it, expect } from "vitest";
import { routeConversation } from "../intentRouter";
import type { ConversationState } from "../conversationState";

// ── Helper states ───────────────────────────────────────────────────────

const discoveryState: ConversationState = { mode: "DISCOVERY" };

const recState: ConversationState = {
  mode: "RECOMMENDATION",
  categoryName: "Skincare",
  recommendedProducts: ["p1", "p2", "p3"],
  budget: { min: 0, max: 50000 },
};

const singleRecState: ConversationState = {
  mode: "RECOMMENDATION",
  categoryName: "Skincare",
  recommendedProducts: ["p1"],
};

const qualState: ConversationState = {
  mode: "QUALIFICATION",
  categoryName: "Skincare",
};

const chatState: ConversationState = { mode: "GENERAL_CHAT" };

function expectIntent(message: string, state: ConversationState, expected: string) {
  const result = routeConversation(message, state);
  expect(result.intent).toBe(expected);
}

// ═════════════════════════════════════════════════════════════════════════
// ── PRODUCT_SELECTION ───────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════

describe("PRODUCT_SELECTION", () => {
  it('routes "the first one" to PRODUCT_SELECTION in RECOMMENDATION mode', () => {
    expectIntent("the first one", recState, "PRODUCT_SELECTION");
  });

  it('routes "second" to PRODUCT_SELECTION', () => {
    expectIntent("second one", recState, "PRODUCT_SELECTION");
  });

  it('routes "third" to PRODUCT_SELECTION', () => {
    expectIntent("the third", recState, "PRODUCT_SELECTION");
  });

  it('routes "pick number 2" to PRODUCT_SELECTION', () => {
    expectIntent("pick number 2", recState, "PRODUCT_SELECTION");
  });

  it('routes "I will take the first" to PRODUCT_SELECTION', () => {
    expectIntent("I will take the first", recState, "PRODUCT_SELECTION");
  });

  it('routes "pick number 2" to PRODUCT_SELECTION', () => {
    expectIntent("pick number 2", recState, "PRODUCT_SELECTION");
  });

  it('routes "#2" to PRODUCT_SELECTION', () => {
    expectIntent("#2", recState, "PRODUCT_SELECTION");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ── PRODUCT_DETAILS ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════

describe("PRODUCT_DETAILS", () => {
  it('routes "tell me more" to PRODUCT_DETAILS', () => {
    expectIntent("tell me more", recState, "PRODUCT_DETAILS");
  });

  it('routes "more details" to PRODUCT_DETAILS', () => {
    expectIntent("more details", recState, "PRODUCT_DETAILS");
  });

  it('routes "details please" to PRODUCT_DETAILS', () => {
    expectIntent("details please", recState, "PRODUCT_DETAILS");
  });

  it('routes "describe the product" to PRODUCT_DETAILS', () => {
    expectIntent("describe it", recState, "PRODUCT_DETAILS");
  });

  it('routes "tell me about it" to PRODUCT_DETAILS', () => {
    expectIntent("tell me about it", recState, "PRODUCT_DETAILS");
  });

  it('routes "is it good for oily skin" to PRODUCT_DETAILS', () => {
    expectIntent("is it good for oily skin?", recState, "PRODUCT_DETAILS");
  });

  it('routes "does it come in another color" to PRODUCT_DETAILS', () => {
    expectIntent("does it come in another color?", recState, "PRODUCT_DETAILS");
  });

  it('routes "recommend one" to PRODUCT_DETAILS', () => {
    expectIntent("recommend one", recState, "PRODUCT_DETAILS");
  });

  it('routes "which one do you recommend" to PRODUCT_DETAILS', () => {
    expectIntent("which one do you recommend", recState, "PRODUCT_DETAILS");
  });

  it('routes "is it available" to PRODUCT_DETAILS', () => {
    expectIntent("is it available", recState, "PRODUCT_DETAILS");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ── COMPARE ─────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════

describe("COMPARE", () => {
  it('routes "what\'s the difference" to COMPARE when >= 2 recs', () => {
    expectIntent("what's the difference", recState, "COMPARE");
  });

  it('routes "compare them" to COMPARE', () => {
    expectIntent("compare them", recState, "COMPARE");
  });

  it('routes "which is better" to COMPARE', () => {
    expectIntent("which is better", recState, "COMPARE");
  });

  it('routes "difference between them" to COMPARE', () => {
    expectIntent("difference between the two", recState, "COMPARE");
  });

  it('routes "how do they compare" to COMPARE', () => {
    expectIntent("how do they compare", recState, "COMPARE");
  });

  it('routes "vs" to COMPARE', () => {
    expectIntent("product A vs product B", recState, "COMPARE");
  });

  it("does NOT route COMPARE when only 1 recommendation exists", () => {
    const result = routeConversation("compare them", singleRecState);
    expect(result.intent).not.toBe("COMPARE");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ── CHEAPER_ALTERNATIVE ─────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════

describe("CHEAPER_ALTERNATIVE", () => {
  it('routes "show me cheaper ones" to CHEAPER_ALTERNATIVE', () => {
    expectIntent("show me cheaper ones", recState, "CHEAPER_ALTERNATIVE");
  });

  it('routes "too expensive" to CHEAPER_ALTERNATIVE', () => {
    expectIntent("too expensive", recState, "CHEAPER_ALTERNATIVE");
  });

  it('routes "more affordable" to CHEAPER_ALTERNATIVE', () => {
    expectIntent("show more affordable options", recState, "CHEAPER_ALTERNATIVE");
  });

  it('routes "out of my budget" to CHEAPER_ALTERNATIVE', () => {
    expectIntent("that's out of my budget", recState, "CHEAPER_ALTERNATIVE");
  });

  it('routes "show more options" to CHEAPER_ALTERNATIVE', () => {
    expectIntent("show more options", recState, "CHEAPER_ALTERNATIVE");
  });

  it('routes "show another" to CHEAPER_ALTERNATIVE', () => {
    expectIntent("show another one", recState, "CHEAPER_ALTERNATIVE");
  });

  it('routes "anything else" to CHEAPER_ALTERNATIVE', () => {
    expectIntent("do you have anything else", recState, "CHEAPER_ALTERNATIVE");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ── NEW_SHOPPING_JOURNEY ────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════

describe("NEW_SHOPPING_JOURNEY", () => {
  it('routes "I\'m looking for shoes" to NEW_SHOPPING_JOURNEY in RECOMMENDATION mode', () => {
    const result = routeConversation("I'm looking for shoes", recState);
    expect(result.intent).toBe("NEW_SHOPPING_JOURNEY");
    expect(result.detectedCategory).toContain("shoes");
  });

  it('routes "forget skincare, show me laptops" to NEW_SHOPPING_JOURNEY', () => {
    const result = routeConversation("forget skincare, show me laptops", recState);
    expect(result.intent).toBe("NEW_SHOPPING_JOURNEY");
  });

  it('routes "show me face products" to NEW_SHOPPING_JOURNEY', () => {
    const result = routeConversation("show me face products", recState);
    expect(result.intent).toBe("NEW_SHOPPING_JOURNEY");
  });

  it('routes "what about laptops instead" to NEW_SHOPPING_JOURNEY', () => {
    const result = routeConversation("what about laptops instead", recState);
    expect(result.intent).toBe("NEW_SHOPPING_JOURNEY");
  });

  it('routes "actually, I need a different product" to NEW_SHOPPING_JOURNEY', () => {
    const result = routeConversation("actually, I need a different product", recState);
    expect(result.intent).toBe("NEW_SHOPPING_JOURNEY");
  });

  it("routes single word category change to NEW_SHOPPING_JOURNEY", () => {
    const result = routeConversation("shoes", recState);
    expect(result.intent).toBe("NEW_SHOPPING_JOURNEY");
    expect(result.detectedCategory).toBe("shoes");
  });

  it("does NOT route 'thanks' to NEW_SHOPPING_JOURNEY", () => {
    const result = routeConversation("thanks", recState);
    expect(result.intent).not.toBe("NEW_SHOPPING_JOURNEY");
  });

  it("does NOT route 'yes' to NEW_SHOPPING_JOURNEY", () => {
    const result = routeConversation("yes", recState);
    expect(result.intent).not.toBe("NEW_SHOPPING_JOURNEY");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ── DISCOVERY ───────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════

describe("DISCOVERY", () => {
  it('routes "I need a moisturizer" to DISCOVERY in DISCOVERY mode', () => {
    expectIntent("I need a moisturizer", discoveryState, "DISCOVERY");
  });

  it('routes "skin care products" to DISCOVERY in DISCOVERY mode', () => {
    expectIntent("skin care products", discoveryState, "DISCOVERY");
  });

  it('routes "show me lipstick" to NEW_SHOPPING_JOURNEY in QUALIFICATION mode', () => {
    // qualState has categoryName "Skincare" — "lipstick" is a category change
    const result = routeConversation("show me lipstick", qualState);
    expect(result.intent).toBe("NEW_SHOPPING_JOURNEY");
  });

  it("routes non-shopping chat to GENERAL_CHAT in DISCOVERY mode", () => {
    expectIntent("how does shipping work", discoveryState, "GENERAL_CHAT");
  });

  it('routes "hi" to GENERAL_CHAT in DISCOVERY mode', () => {
    expectIntent("hi", discoveryState, "GENERAL_CHAT");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ── GENERAL_CHAT ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════

describe("GENERAL_CHAT", () => {
  it('routes "thanks" to GENERAL_CHAT in RECOMMENDATION mode', () => {
    expectIntent("thanks", recState, "GENERAL_CHAT");
  });

  it('routes "what are your hours" to GENERAL_CHAT in RECOMMENDATION mode', () => {
    expectIntent("what are your hours", recState, "GENERAL_CHAT");
  });

  it('routes "how does shipping work" to GENERAL_CHAT in RECOMMENDATION mode', () => {
    expectIntent("how does shipping work", recState, "GENERAL_CHAT");
  });

  it("routes weather question to GENERAL_CHAT in any mode", () => {
    expectIntent("what's the weather like", recState, "GENERAL_CHAT");
  });

  it("routes unknown chat to GENERAL_CHAT in GENERAL_CHAT mode", () => {
    expectIntent("I like your products", chatState, "GENERAL_CHAT");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ── Full scenarios ──────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════

describe("full scenarios — no qualification restart", () => {
  it("serum → recommendations → tell me more stays in product context", () => {
    // After serum was recommended
    const stateAfterRec: ConversationState = {
      mode: "RECOMMENDATION",
      categoryName: "Serums",
      recommendedProducts: ["s1", "s2", "s3"],
    };
    expectIntent("tell me more", stateAfterRec, "PRODUCT_DETAILS");
  });

  it("recommendations → compare them", () => {
    expectIntent("compare them", recState, "COMPARE");
  });

  it("recommendations → the first one → product details", () => {
    expectIntent("the first one", recState, "PRODUCT_SELECTION");
  });

  it("active product → is it good for oily skin → product details", () => {
    const stateWithActive: ConversationState = {
      ...recState,
      activeProductId: "p1",
    };
    expectIntent("is it good for oily skin?", stateWithActive, "PRODUCT_DETAILS");
  });

  it("skincare → actually show me shoes → new shopping journey", () => {
    const result = routeConversation("actually show me shoes", recState);
    expect(result.intent).toBe("NEW_SHOPPING_JOURNEY");
  });

  it("skincare → 'shoes' → new shopping journey", () => {
    const result = routeConversation("shoes", recState);
    expect(result.intent).toBe("NEW_SHOPPING_JOURNEY");
  });
});

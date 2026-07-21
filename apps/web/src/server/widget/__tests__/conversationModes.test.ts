import { describe, it, expect } from "vitest";
import {
  getInitialMode,
  modeForAdaptiveResult,
  modeForFollowUpType,
} from "../conversationModes";

describe("getInitialMode", () => {
  it("returns DISCOVERY for new conversations", () => {
    expect(getInitialMode()).toBe("DISCOVERY");
  });
});

describe("modeForAdaptiveResult", () => {
  it("returns RECOMMENDATION when products were recommended", () => {
    expect(modeForAdaptiveResult(true, false)).toBe("RECOMMENDATION");
  });

  it("returns RECOMMENDATION when fromEngine is true with recommendations", () => {
    // Even if isAskingFollowUp is true, hasRecommendations takes priority
    expect(modeForAdaptiveResult(true, true)).toBe("RECOMMENDATION");
  });

  it("returns QUALIFICATION when adaptive is asking a follow-up question", () => {
    expect(modeForAdaptiveResult(false, true)).toBe("QUALIFICATION");
  });

  it("returns DISCOVERY when no recommendations and not asking follow-up", () => {
    expect(modeForAdaptiveResult(false, false)).toBe("DISCOVERY");
  });
});

describe("modeForFollowUpType", () => {
  it("returns RECOMMENDATION for product_details", () => {
    expect(modeForFollowUpType("product_details")).toBe("RECOMMENDATION");
  });

  it("returns RECOMMENDATION for compare", () => {
    expect(modeForFollowUpType("compare")).toBe("RECOMMENDATION");
  });

  it("returns RECOMMENDATION for constraint_change", () => {
    expect(modeForFollowUpType("constraint_change")).toBe("RECOMMENDATION");
  });

  it("returns DISCOVERY for new_search", () => {
    expect(modeForFollowUpType("new_search")).toBe("DISCOVERY");
  });

  it("returns GENERAL_CHAT for unrelated", () => {
    expect(modeForFollowUpType("unrelated")).toBe("GENERAL_CHAT");
  });

  it("returns GENERAL_CHAT for null (no classification)", () => {
    expect(modeForFollowUpType(null)).toBe("GENERAL_CHAT");
  });
});

import { describe, it, expect } from "vitest";
import { IntentLearning } from "../intentLearning";

describe("IntentLearning Engine", () => {
  it("normalizes messy raw query strings into uniform intent keys", () => {
    const raw = "I need comfortable running shoes under ₦100,000!";
    const key = IntentLearning.normalizeIntentKey(raw);

    expect(key).toBe("i_need_comfortable_running_shoes_under_100000");
    expect(key).not.toContain("₦");
    expect(key).not.toContain("!");
  });

  it("handles fallback for empty intent queries", () => {
    expect(IntentLearning.normalizeIntentKey("")).toBe("general_inquiry");
  });
});

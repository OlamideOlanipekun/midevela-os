import { describe, it, expect } from "vitest";
import { evolveIntent } from "../intentEvolution";

describe("Intent Evolution Engine", () => {
  it("progresses intent from INITIAL to REFINED when category constraint is added", () => {
    const res = evolveIntent("INITIAL", {}, { categoryName: "running-shoes" });
    expect(res.nextStage).toBe("REFINED");
    expect(res.updatedConstraints.categoryName).toBe("running-shoes");
    expect(res.intentSummary).toContain("shopping for running-shoes");
  });

  it("progresses to CONSTRAINED when 3+ constraint dimensions are set", () => {
    const res = evolveIntent(
      "REFINED",
      { categoryName: "running-shoes" },
      { maxPrice: 100000, color: "black", brand: "Nike" }
    );
    expect(res.nextStage).toBe("CONSTRAINED");
    expect(res.updatedConstraints.maxPrice).toBe(100000);
    expect(res.updatedConstraints.color).toBe("black");
    expect(res.intentSummary).toContain("budget ≤ ₦100,000");
  });

  it("transitions to DECISION stage when comparison is requested", () => {
    const res = evolveIntent(
      "CONSTRAINED",
      { categoryName: "running-shoes", maxPrice: 100000 },
      {},
      "which one should I buy between Product A vs B?"
    );
    expect(res.nextStage).toBe("DECISION");
  });
});

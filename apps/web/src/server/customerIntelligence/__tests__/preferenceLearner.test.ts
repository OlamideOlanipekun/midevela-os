import { describe, it, expect } from "vitest";
import {
  recordExplicitPreference,
  recordBehavioralInteraction,
  formatPreferencesForPrompt,
} from "../preferenceLearner";
import { ExplicitPreference, InferredPreference } from "../types";

describe("Preference Learner Engine", () => {
  it("records explicit preference with confidence 1.0", () => {
    const res = recordExplicitPreference({}, {}, "color", "black");
    expect(res.explicitPreferences["color"]).toBeDefined();
    expect(res.explicitPreferences["color"].confidence).toBe(1.0);
    expect(res.explicitPreferences["color"].source).toBe("SHOPPER_STATEMENT");
  });

  it("infers preference from behavior with lower confidence", () => {
    let explicit: Record<string, ExplicitPreference> = {};
    let inferred: Record<string, InferredPreference> = {};

    const step1 = recordBehavioralInteraction(explicit, inferred, "brand", "Nike");
    expect(step1.inferredPreferences["brand"].confidence).toBe(0.5);
    expect(step1.inferredPreferences["brand"].evidenceCount).toBe(1);

    const step2 = recordBehavioralInteraction(explicit, step1.inferredPreferences, "brand", "Nike");
    expect(step2.inferredPreferences["brand"].confidence).toBe(0.7);
    expect(step2.inferredPreferences["brand"].evidenceCount).toBe(2);
  });

  it("formats inferred preferences as gentle suggestions rather than facts", () => {
    const explicit = recordExplicitPreference({}, {}, "color", "black").explicitPreferences;
    const inferred = recordBehavioralInteraction({}, {}, "brand", "Nike");
    const inferred2 = recordBehavioralInteraction({}, inferred.inferredPreferences, "brand", "Nike");

    const formatted = formatPreferencesForPrompt(explicit, inferred2.inferredPreferences);
    expect(formatted.explicitText).toContain("Explicitly stated color: \"black\"");
    expect(formatted.inferredText).toContain("frame as gentle suggestion, not fact");
  });
});

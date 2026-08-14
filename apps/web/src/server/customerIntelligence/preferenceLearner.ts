import { ExplicitPreference, InferredPreference } from "./types";

export interface PreferenceUpdateResult {
  explicitPreferences: Record<string, ExplicitPreference>;
  inferredPreferences: Record<string, InferredPreference>;
}

export function recordExplicitPreference(
  existingExplicit: Record<string, ExplicitPreference>,
  existingInferred: Record<string, InferredPreference>,
  key: string,
  value: string
): PreferenceUpdateResult {
  const explicit: Record<string, ExplicitPreference> = { ...(existingExplicit || {}) };
  const inferred: Record<string, InferredPreference> = { ...(existingInferred || {}) };

  explicit[key] = {
    key,
    value,
    confidence: 1.0,
    source: "SHOPPER_STATEMENT",
    updatedAt: new Date().toISOString(),
  };

  // If we had an inferred preference for this key, remove or align it
  delete inferred[key];

  return { explicitPreferences: explicit, inferredPreferences: inferred };
}

export function recordBehavioralInteraction(
  existingExplicit: Record<string, ExplicitPreference>,
  existingInferred: Record<string, InferredPreference>,
  key: string,
  value: string
): PreferenceUpdateResult {
  const explicit: Record<string, ExplicitPreference> = { ...(existingExplicit || {}) };
  const inferred: Record<string, InferredPreference> = { ...(existingInferred || {}) };

  // If explicit preference already exists for this key, explicit statement overrides behavior
  if (explicit[key]) {
    return { explicitPreferences: explicit, inferredPreferences: inferred };
  }

  const current = inferred[key];
  if (!current) {
    inferred[key] = {
      key,
      value,
      confidence: 0.5,
      evidenceCount: 1,
      source: "BEHAVIORAL_INFERENCE",
      updatedAt: new Date().toISOString(),
    };
  } else if (current.value === value) {
    const newCount = current.evidenceCount + 1;
    // Asymptotically approach 0.9 (never reach 1.0 for inferred)
    const newConfidence = Math.min(0.9, 0.5 + newCount * 0.1);
    inferred[key] = {
      key,
      value,
      confidence: Math.round(newConfidence * 100) / 100,
      evidenceCount: newCount,
      source: "BEHAVIORAL_INFERENCE",
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Value conflict — reduce confidence
    const newCount = Math.max(1, current.evidenceCount - 1);
    const newConfidence = Math.max(0.3, current.confidence - 0.2);
    inferred[key] = {
      ...current,
      confidence: Math.round(newConfidence * 100) / 100,
      evidenceCount: newCount,
      updatedAt: new Date().toISOString(),
    };
  }

  return { explicitPreferences: explicit, inferredPreferences: inferred };
}

/**
  Formats preference statements for the AI Concierge safely.
  Guardrail: Inferred preferences are presented as suggestions ("You seem interested in..."),
  never as established facts unless confirmed.
 */
export function formatPreferencesForPrompt(
  explicit: Record<string, ExplicitPreference>,
  inferred: Record<string, InferredPreference>
): { explicitText: string; inferredText: string } {
  const explicitLines = Object.values(explicit || {}).map(
    (pref) => `- Explicitly stated ${pref.key}: "${pref.value}" (Confidence: 100%)`
  );

  const inferredLines = Object.values(inferred || {})
    .filter((pref) => pref.confidence >= 0.6)
    .map(
      (pref) =>
        `- Inferred interest in ${pref.key} = "${pref.value}" (Confidence: ${Math.round(
          pref.confidence * 100
        )}% based on ${pref.evidenceCount} interactions — frame as gentle suggestion, not fact)`
    );

  return {
    explicitText: explicitLines.join("\n"),
    inferredText: inferredLines.join("\n"),
  };
}

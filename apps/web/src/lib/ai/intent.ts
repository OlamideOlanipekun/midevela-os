export type IntentType =
  | "greeting"
  | "discovery"
  | "comparison"
  | "purchase_ready"
  | "objection"
  | "support"
  | "unknown";

/**
 * Classifies visitor message intent based on key phrases and semantic checks.
 * In production, this runs a lightweight LLM classifier call or semantic search.
 */
export async function detectIntent(text: string): Promise<IntentType> {
  const lower = text.toLowerCase().trim();

  // Simple rule-based intent parsing (mocking LLM intent classifiers)
  if (
    lower === "hi" ||
    lower === "hello" ||
    lower === "hey" ||
    lower.startsWith("good day") ||
    lower.startsWith("good morning")
  ) {
    return "greeting";
  }

  if (
    lower.includes("shipping") ||
    lower.includes("delivery") ||
    lower.includes("return") ||
    lower.includes("refund") ||
    lower.includes("warranty") ||
    lower.includes("hours")
  ) {
    return "support";
  }

  if (
    lower.includes("compare") ||
    lower.includes("difference") ||
    lower.includes("versus") ||
    lower.includes("vs") ||
    lower.includes("which is better")
  ) {
    return "comparison";
  }

  if (
    lower.includes("buy") ||
    lower.includes("pay") ||
    lower.includes("checkout") ||
    lower.includes("payment link") ||
    lower.includes("purchasing")
  ) {
    return "purchase_ready";
  }

  if (
    lower.includes("expensive") ||
    lower.includes("discount") ||
    lower.includes("price high") ||
    lower.includes("promo") ||
    lower.includes("cheaper")
  ) {
    return "objection";
  }

  if (
    lower.includes("looking for") ||
    lower.includes("want") ||
    lower.includes("need") ||
    lower.includes("recommend") ||
    lower.includes("search") ||
    lower.includes("show me")
  ) {
    return "discovery";
  }

  return "unknown";
}

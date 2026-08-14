import { IntentStage, IntentConstraints } from "./types";

export interface IntentEvolutionResult {
  nextStage: IntentStage;
  updatedConstraints: IntentConstraints;
  intentSummary: string;
}

export function evolveIntent(
  currentStage: IntentStage,
  existingConstraints: IntentConstraints,
  incomingConstraints: Partial<IntentConstraints>,
  userMessage?: string
): IntentEvolutionResult {
  const updatedConstraints: IntentConstraints = { ...existingConstraints };

  if (incomingConstraints.categoryId) updatedConstraints.categoryId = incomingConstraints.categoryId;
  if (incomingConstraints.categoryName) updatedConstraints.categoryName = incomingConstraints.categoryName;
  if (incomingConstraints.productType) updatedConstraints.productType = incomingConstraints.productType;
  if (incomingConstraints.minPrice !== undefined) updatedConstraints.minPrice = incomingConstraints.minPrice;
  if (incomingConstraints.maxPrice !== undefined) updatedConstraints.maxPrice = incomingConstraints.maxPrice;
  if (incomingConstraints.currency) updatedConstraints.currency = incomingConstraints.currency;
  if (incomingConstraints.color) updatedConstraints.color = incomingConstraints.color;
  if (incomingConstraints.style) updatedConstraints.style = incomingConstraints.style;
  if (incomingConstraints.brand) updatedConstraints.brand = incomingConstraints.brand;
  if (incomingConstraints.useCase) updatedConstraints.useCase = incomingConstraints.useCase;
  if (incomingConstraints.attributes) {
    updatedConstraints.attributes = {
      ...(existingConstraints.attributes || {}),
      ...incomingConstraints.attributes,
    };
  }

  // Count constraint dimensions
  let constraintCount = 0;
  if (updatedConstraints.categoryId || updatedConstraints.categoryName || updatedConstraints.productType) constraintCount++;
  if (updatedConstraints.minPrice !== undefined || updatedConstraints.maxPrice !== undefined) constraintCount++;
  if (updatedConstraints.color) constraintCount++;
  if (updatedConstraints.brand) constraintCount++;
  if (updatedConstraints.style || updatedConstraints.useCase) constraintCount++;
  if (updatedConstraints.attributes && Object.keys(updatedConstraints.attributes).length > 0) constraintCount++;

  let nextStage: IntentStage = "INITIAL";

  if (currentStage === "DECISION" || (userMessage && /compare|which one|versus|vs|decision|buy this/i.test(userMessage))) {
    nextStage = "DECISION";
  } else if (constraintCount >= 3) {
    nextStage = "CONSTRAINED";
  } else if (constraintCount >= 1) {
    nextStage = "REFINED";
  } else {
    nextStage = "INITIAL";
  }

  // Generate intent summary description
  const parts: string[] = [];
  if (updatedConstraints.categoryName || updatedConstraints.productType) {
    parts.push(`shopping for ${updatedConstraints.categoryName || updatedConstraints.productType}`);
  } else {
    parts.push("shopping");
  }

  if (updatedConstraints.brand) parts.push(`brand ${updatedConstraints.brand}`);
  if (updatedConstraints.color) parts.push(`color ${updatedConstraints.color}`);
  if (updatedConstraints.maxPrice) {
    const curr = updatedConstraints.currency || "₦";
    parts.push(`budget ≤ ${curr}${updatedConstraints.maxPrice.toLocaleString()}`);
  }

  const intentSummary = parts.join(", ");

  return {
    nextStage,
    updatedConstraints,
    intentSummary,
  };
}

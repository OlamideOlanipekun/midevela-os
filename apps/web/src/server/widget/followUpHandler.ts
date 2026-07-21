import { completeJson } from "@/server/conversation/llm";
import prisma from "@/lib/prisma";
import { compareProducts } from "@/server/widget/compare";
import { recommendProducts, type RecommendedProduct } from "@/server/widget/recommend";
import { listCategoriesForWidget } from "@/server/catalog/categories";
import type { ShoppingContext } from "@/server/conversation/engine";

// ── Types ─────────────────────────────────────────────────────────────────

export type FollowUpType = "product_details" | "compare" | "constraint_change" | "new_search" | "unrelated";

export interface FollowUpClassification {
  type: FollowUpType;
  /** For product_details: the product name the user is asking about */
  targetProductName?: string;
  /** For compare: product names to compare */
  compareProductNames?: string[];
  /** For constraint_change: which constraint changed */
  constraintCategory?: "budget" | "brand" | "category" | "other";
  /** For constraint_change: the new value if the user specified one */
  constraintValue?: string;
  /** The raw user message */
  userMessage: string;
}

export interface FollowUpResult {
  replyText: string;
  recommendations: RecommendedProduct[];
}

// ── Classification prompt ─────────────────────────────────────────────────

function buildClassificationPrompt(
  messageText: string,
  lastRecommendations: RecommendedProduct[],
): string {
  const productList = lastRecommendations
    .map((p, i) => `  ${i + 1}. "${p.name}" — ${p.price}${p.brand ? ` by ${p.brand}` : ""}`)
    .join("\n");

  return [
    `The assistant just showed the shopper these product recommendations:`,
    ``,
    productList,
    ``,
    `Now the shopper replies: "${messageText}"`,
    ``,
    `Classify the shopper's intent based on what was recommended:`,
    ``,
    `- "product_details" — Asking about a specific product from the list (e.g., "tell me more about [product]", "more details", "is it good for oily skin", "does it come in another color", "is it available", "recommend one")`,
    `- "compare" — Asking to compare products from the list (e.g., "what's the difference", "which is better", "compare them")`,
    `- "constraint_change" — Changing their requirements (e.g., "show me cheaper ones", "I want a different brand", "do you have it in a different color")`,
    `- "new_search" — Starting a new, different shopping search (e.g., "actually I need a different product", "what about laptops", "show me skin care instead")`,
    `- "unrelated" — Not about the products at all (e.g., "thanks", "how does shipping work", "what are your hours")`,
    ``,
    `For product_details, set "targetProductName" to the product name the user is referring to (or "first"/"last"/"cheapest"/"most expensive" if they don't name it).`,
    `For compare, set "compareProductNames" to the products they want compared.`,
    `For constraint_change, set "constraintCategory" and "constraintValue" if a specific value was mentioned.`,
    ``,
    `Respond with ONLY JSON:`,
    `{`,
    `  "type": "product_details" | "compare" | "constraint_change" | "new_search" | "unrelated",`,
    `  "targetProductName": string | null,`,
    `  "compareProductNames": string[] | null,`,
    `  "constraintCategory": "budget" | "brand" | "category" | "other" | null,`,
    `  "constraintValue": string | null`,
    `}`,
  ].join("\n");
}

// ── Classifier ────────────────────────────────────────────────────────────

export async function classifyFollowUpIntent(
  messageText: string,
  lastRecommendations: RecommendedProduct[],
): Promise<FollowUpClassification | null> {
  if (lastRecommendations.length === 0) return null;

  const prompt = buildClassificationPrompt(messageText, lastRecommendations);
  const messages = [{ role: "system" as const, content: prompt }];

  try {
    const result = await completeJson(messages);
    const parsed = tryParseJson(result.raw);

    if (!parsed || typeof parsed.type !== "string") return null;

    const validTypes: FollowUpType[] = ["product_details", "compare", "constraint_change", "new_search", "unrelated"];
    const type = validTypes.includes(parsed.type as FollowUpType)
      ? (parsed.type as FollowUpType)
      : null;

    if (!type) return null;

    return {
      type,
      targetProductName: typeof parsed.targetProductName === "string" ? parsed.targetProductName : undefined,
      compareProductNames: Array.isArray(parsed.compareProductNames)
        ? parsed.compareProductNames.filter((n: unknown) => typeof n === "string")
        : undefined,
      constraintCategory: ["budget", "brand", "category", "other"].includes(parsed.constraintCategory as string)
        ? (parsed.constraintCategory as "budget" | "brand" | "category" | "other")
        : undefined,
      constraintValue: typeof parsed.constraintValue === "string" ? parsed.constraintValue : undefined,
      userMessage: messageText,
    };
  } catch {
    return null;
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────

function tryParseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Resolve a target product name reference to an actual product in the list */
function resolveProduct(
  reference: string | undefined,
  recommendations: RecommendedProduct[],
): RecommendedProduct | null {
  if (!reference || recommendations.length === 0) return null;

  const ref = reference.toLowerCase().trim();

  // Positional references
  if (ref === "first" || ref === "1") return recommendations[0];
  if (ref === "last") return recommendations[recommendations.length - 1];
  if (ref === "cheapest") {
    return recommendations.reduce((cheapest, p) => {
      const pPrice = parsePrice(p.price);
      const cPrice = parsePrice(cheapest.price);
      return pPrice < cPrice ? p : cheapest;
    }, recommendations[0]);
  }
  if (ref === "most expensive") {
    return recommendations.reduce((expensive, p) => {
      const pPrice = parsePrice(p.price);
      const ePrice = parsePrice(expensive.price);
      return pPrice > ePrice ? p : expensive;
    }, recommendations[0]);
  }

  // Name match (partial)
  const match = recommendations.find((p) => p.name.toLowerCase().includes(ref));
  return match ?? null;
}

/** Very crude price parser — extracts the first number from a price string */
function parsePrice(price: string): number {
  const m = price.replace(/[^0-9.]/g, "");
  return m ? parseFloat(m) : Infinity;
}

/** Handle product_details follow-up */
async function handleProductDetails(
  orgId: string,
  classification: FollowUpClassification,
  lastRecommendations: RecommendedProduct[],
): Promise<FollowUpResult | null> {
  const product = resolveProduct(classification.targetProductName, lastRecommendations);
  if (!product) {
    return {
      replyText: "Which product would you like to know more about?",
      recommendations: lastRecommendations,
    };
  }

  // Fetch full product data from DB
  const dbProduct = await prisma.product.findFirst({
    where: { id: product.id, orgId },
  });

  if (!dbProduct) {
    return {
      replyText: `I'm sorry, I couldn't find details for "${product.name}" right now.`,
      recommendations: lastRecommendations,
    };
  }

  // Build context for the LLM to answer the user's question
  const productInfo = [
    `Name: ${dbProduct.name}`,
    dbProduct.brand ? `Brand: ${dbProduct.brand}` : null,
    `Price: ${product.price}`,
    dbProduct.description ? `Description: ${dbProduct.description}` : null,
    dbProduct.aiDescription ? `Summary: ${dbProduct.aiDescription}` : null,
    dbProduct.attributes && typeof dbProduct.attributes === "object"
      ? `Attributes: ${JSON.stringify(dbProduct.attributes)}`
      : null,
    `In stock: ${dbProduct.inventoryStatus !== "OUT_OF_STOCK" ? "Yes" : "No"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const detailMessages = [
    {
      role: "system" as const,
      content: [
        `You are a helpful shopping assistant. A shopper is asking about a product they were recommended.`,
        ``,
        `Product details:`,
        productInfo,
        ``,
        `The shopper says: "${classification.userMessage}"`,
        ``,
        `Answer their question naturally based ONLY on the product details above. Be concise (2-3 sentences). If the answer isn't in the product data, say so — don't invent details. If they're asking a general question (e.g., "tell me more"), give a friendly summary of what's available.`,
      ].join("\n"),
    },
  ];

  try {
    const result = await completeJson(detailMessages);
    // The LLM response might not be structured JSON — use the text directly
    let replyText = result.raw;
    // Try to extract meaningful text if it's JSON-wrapped
    try {
      const parsed = JSON.parse(replyText);
      if (typeof parsed?.replyText === "string") replyText = parsed.replyText;
      else if (typeof parsed?.response === "string") replyText = parsed.response;
    } catch {
      // Not JSON — use raw text as-is
    }

    return {
      replyText,
      recommendations: lastRecommendations,
    };
  } catch {
    return {
      replyText: `Here's what I know about **${product.name}**: ${product.price}${dbProduct.description ? `. ${dbProduct.description}` : ""}`,
      recommendations: lastRecommendations,
    };
  }
}

/** Handle compare follow-up */
async function handleCompare(
  orgId: string,
  classification: FollowUpClassification,
  lastRecommendations: RecommendedProduct[],
): Promise<FollowUpResult | null> {
  let productIds: string[] = [];

  if (classification.compareProductNames && classification.compareProductNames.length >= 2) {
    // User specified which products to compare
    productIds = classification.compareProductNames
      .map((name) => {
        const p = resolveProduct(name, lastRecommendations);
        return p?.id;
      })
      .filter((id): id is string => Boolean(id));
  }

  // If we don't have 2 specific products, compare the first two
  if (productIds.length < 2 && lastRecommendations.length >= 2) {
    productIds = [lastRecommendations[0].id, lastRecommendations[1].id];
  }

  if (productIds.length < 2) {
    return {
      replyText: "I need at least two products to compare. Could you let me know which ones you're interested in?",
      recommendations: lastRecommendations,
    };
  }

  try {
    const compareResult = await compareProducts(orgId, productIds);

    const rowsText = compareResult.rows
      .map((r) => `${r.label}: ${r.values.join(" vs ")}`)
      .join("\n");

    const replyText = [
      `Here's a comparison of the products:\n`,
      rowsText,
      ``,
      compareResult.recommendation,
    ].join("\n");

    return {
      replyText,
      recommendations: lastRecommendations,
    };
  } catch {
    return {
      replyText: "I couldn't compare those products right now. Would you like to ask about something else?",
      recommendations: lastRecommendations,
    };
  }
}

/** Handle constraint_change — re-run recommendations with updated constraints */
async function handleConstraintChange(
  orgId: string,
  classification: FollowUpClassification,
  lastRecommendations: RecommendedProduct[],
  existingContext: ShoppingContext,
): Promise<FollowUpResult | null> {
  // Build updated answers from existing context + constraint change
  const answers: Record<string, string> = {};

  if (existingContext.budget) answers.budget = existingContext.budget;
  if (existingContext.brand) answers.brand = existingContext.brand;
  if (existingContext.answers) {
    for (const [k, v] of Object.entries(existingContext.answers)) {
      if (v) answers[k] = v;
    }
  }

  // Apply the constraint change
  if (classification.constraintCategory === "budget") {
    if (classification.constraintValue) {
      answers.budget = classification.constraintValue;
    } else if (lastRecommendations.length > 0) {
      // "show me cheaper ones" — set ceiling below cheapest product
      const cheapest = [...lastRecommendations].sort(
        (a, b) => parsePrice(a.price) - parsePrice(b.price),
      )[0];
      const cheapestPrice = parsePrice(cheapest.price);
      const newMax = Math.max(1000, Math.floor(cheapestPrice * 0.8));
      answers.budget = `0-${newMax}`;
    }
  }

  if (classification.constraintCategory === "brand" && classification.constraintValue) {
    answers.brand = classification.constraintValue;
  }

  // Resolve category from existing context
  const categoryName = existingContext.categoryName;
  if (!categoryName) {
    // No category known — fall through to adaptive discovery
    return null;
  }

  const categories = await listCategoriesForWidget(orgId);
  const category = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!category) return null;

  const products = await recommendProducts({
    orgId,
    categoryId: category.id,
    answers,
  });

  if (products.length > 0) {
    const top = products[0];
    const productLine = products.length > 1
      ? `Here are some updated options I found:\n\n**${top.name}** — ${top.price}`
      : `I found **${top.name}** — ${top.price}.`;

    const restLines = products.slice(1).map((p) => `**${p.name}** — ${p.price}`).join("\n");

    const replyText = restLines
      ? `${productLine}\n${restLines}\n\nWould you like more details on any of these?`
      : `${productLine}\n\nWould you like to know more about it?`;

    return { replyText, recommendations: products };
  }

  return {
    replyText: `I couldn't find any products matching your updated preferences in ${categoryName}. Would you like to try different options?`,
    recommendations: lastRecommendations,
  };
}

// ── Main entry point ──────────────────────────────────────────────────────

export async function handleFollowUp(
  orgId: string,
  classification: FollowUpClassification,
  lastRecommendations: RecommendedProduct[],
  existingContext: ShoppingContext,
): Promise<FollowUpResult | null> {
  try {
    switch (classification.type) {
      case "product_details":
        return await handleProductDetails(orgId, classification, lastRecommendations);

      case "compare":
        return await handleCompare(orgId, classification, lastRecommendations);

      case "constraint_change":
        return await handleConstraintChange(orgId, classification, lastRecommendations, existingContext);

      // new_search and unrelated fall through to adaptive discovery / normal chat
      default:
        return null;
    }
  } catch (err) {
    console.error("Follow-up handler error:", err);
    return null;
  }
}

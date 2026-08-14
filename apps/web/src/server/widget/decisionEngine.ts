/**
 * Decision Engine (Milestone B7)
 *
 * Answers decision-support questions grounded exclusively in merchant data:
 *   "Which is better for office use?"
 *   "Is this worth the price?"
 *   "Which would you recommend?"
 *
 * Evaluates shopper requirements against product attributes and
 * generates a recommendation with clear, factual reasoning.
 * Never fabricates product expertise or invents specifications.
 */

import prisma from "@/lib/prisma";
import type { Product } from "@prisma/client";
import { completeJson, type ChatMessage } from "@/server/conversation/llm";
import { formatMoney } from "@/server/catalog/money";

export interface DecisionInput {
  orgId: string;
  /** Product IDs to evaluate — shortlist or comparison set */
  productIds: string[];
  /** Shopper's stated question / decision criteria */
  question: string;
  /** Accumulated shopper context */
  context?: {
    useCase?: string;
    budget?: { min?: number; max?: number };
    categoryName?: string;
    knownInformation?: Record<string, string>;
  };
}

export interface DecisionResult {
  recommendation: string;
  reasoning: string;
  /** ID of the recommended product, if a clear winner */
  recommendedProductId?: string;
  /** Whether the LLM had enough data to make a confident recommendation */
  confident: boolean;
}

/**
 * Builds a compact product fact sheet from the DB record.
 * Only includes fields that are actually present — no placeholder specs.
 */
function buildProductFactSheet(p: Product & { category?: { name: string } | null }): string {
  const facts: string[] = [`Name: ${p.name}`];
  if (p.brand) facts.push(`Brand: ${p.brand}`);
  facts.push(`Price: ${formatMoney(p.price, p.currency)}`);
  facts.push(`Availability: ${p.inventoryStatus.replace(/_/g, " ").toLowerCase()}`);
  if (p.category?.name) facts.push(`Category: ${p.category.name}`);
  if (p.description) facts.push(`Description: ${p.description}`);

  const attrs = (p.attributes ?? {}) as Record<string, unknown>;
  const attrKeys = Object.keys(attrs).filter(
    (k) => attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== ""
  );
  if (attrKeys.length > 0) {
    facts.push(
      `Attributes: ${attrKeys.map((k) => `${k}: ${String(attrs[k])}`).join(", ")}`
    );
  }

  return facts.join("\n");
}

/**
 * Decide between multiple products given a shopper question.
 * Strictly grounded: the model only works with the fact sheets provided.
 */
export async function decideProducts(input: DecisionInput): Promise<DecisionResult> {
  if (input.productIds.length === 0) {
    return {
      recommendation: "Please share which products you would like help deciding between.",
      reasoning: "",
      confident: false,
    };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: input.productIds }, orgId: input.orgId },
    include: { category: { select: { name: true } } },
  });

  if (products.length === 0) {
    return {
      recommendation: "I couldn't find those products in the store.",
      reasoning: "",
      confident: false,
    };
  }

  // Preserve input order
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = input.productIds
    .map((id) => byId.get(id))
    .filter((p): p is (typeof products)[number] => Boolean(p));

  // Single product — evaluate whether it meets the shopper's criteria
  if (ordered.length === 1) {
    const p = ordered[0];
    return await evaluateSingleProduct(p, input);
  }

  // Multiple products — pick the best match
  return await compareAndDecide(ordered, input);
}

async function evaluateSingleProduct(
  product: Product & { category?: { name: string } | null },
  input: DecisionInput
): Promise<DecisionResult> {
  const factSheet = buildProductFactSheet(product);
  const contextParts = buildContextBlock(input.context);

  const systemPrompt = `You are a shopping assistant for an e-commerce store. 
Evaluate whether the product below suits the shopper's stated needs.
You must ONLY use information from the product fact sheet below.
If a specification is missing, say "The website doesn't provide this information" — never guess.
Respond with ONLY JSON:
{
  "recommendation": string,
  "reasoning": string,
  "confident": boolean
}`;

  const userPrompt = `Shopper question: "${input.question}"
${contextParts}

PRODUCT FACT SHEET:
${factSheet}`;

  return await callDecisionLLM(systemPrompt, userPrompt, product.id);
}

async function compareAndDecide(
  products: Array<Product & { category?: { name: string } | null }>,
  input: DecisionInput
): Promise<DecisionResult> {
  const factSheets = products
    .map((p, i) => `--- Product ${i + 1}: ${p.name} ---\n${buildProductFactSheet(p)}`)
    .join("\n\n");

  const contextParts = buildContextBlock(input.context);

  const systemPrompt = `You are a shopping assistant for an e-commerce store.
Compare the products below and recommend the best one for the shopper's stated question.
You must ONLY use information from the product fact sheets below.
If a specification is missing, say "The website doesn't provide this information" — never invent specs.
Be concise and specific — cite actual product data from the fact sheets.
Respond with ONLY JSON:
{
  "recommendation": string,
  "reasoning": string,
  "recommendedProductName": string | null,
  "confident": boolean
}`;

  const userPrompt = `Shopper question: "${input.question}"
${contextParts}

PRODUCT FACT SHEETS:
${factSheets}`;

  const result = await callDecisionLLM(systemPrompt, userPrompt);

  // Resolve which product was recommended by name
  if (result.recommendation) {
    const rec = (result as DecisionResult & { recommendedProductName?: string });
    const recName: string | undefined = rec.recommendedProductName ?? undefined;
    if (recName) {
      const match = products.find(
        (p) => p.name.toLowerCase().includes(recName.toLowerCase()) ||
               recName.toLowerCase().includes(p.name.toLowerCase())
      );
      if (match) result.recommendedProductId = match.id;
    }
  }

  return result;
}

async function callDecisionLLM(
  systemPrompt: string,
  userPrompt: string,
  defaultProductId?: string
): Promise<DecisionResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const res = await completeJson(messages);
    const parsed = JSON.parse(res.raw);

    if (parsed && typeof parsed.recommendation === "string") {
      return {
        recommendation: parsed.recommendation.trim(),
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "",
        recommendedProductId:
          typeof parsed.recommendedProductId === "string"
            ? parsed.recommendedProductId
            : defaultProductId,
        confident: parsed.confident === true,
      };
    }
  } catch (err) {
    console.error("[DecisionEngine] LLM call failed:", err);
  }

  return {
    recommendation:
      "I don't have enough information from the store to make a strong recommendation. Compare the specs above against what matters most to you.",
    reasoning: "",
    confident: false,
  };
}

function buildContextBlock(
  context?: DecisionInput["context"]
): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.useCase) parts.push(`Use case: ${context.useCase}`);
  if (context.categoryName) parts.push(`Category of interest: ${context.categoryName}`);
  if (context.budget?.max) parts.push(`Budget ceiling: ${context.budget.max}`);
  if (context.knownInformation && Object.keys(context.knownInformation).length > 0) {
    for (const [k, v] of Object.entries(context.knownInformation)) {
      parts.push(`${k}: ${v}`);
    }
  }
  return parts.length > 0 ? `\nShopper context:\n${parts.join("\n")}` : "";
}

import { completeJson, type ChatMessage } from "@/server/conversation/llm";
import { embedText } from "@/server/conversation/embeddings";
import { retrieveContext, type RetrievedContext } from "@/server/retrieval/search";
import type { OrgSettings } from "@/server/tenancy/org";

const VALID_INTENTS = [
  "greeting",
  "discovery",
  "comparison",
  "purchase_ready",
  "objection",
  "support",
  "unknown",
] as const;
type Intent = (typeof VALID_INTENTS)[number];

function isValidIntent(value: unknown): value is Intent {
  return typeof value === "string" && (VALID_INTENTS as readonly string[]).includes(value);
}

interface RecommendationOut {
  id: string;
  name: string;
  price: string;
  whyThis: string;
  url: string | null;
  imageUrl: string | null;
}

export interface ShoppingContext {
  categoryName?: string;
  budget?: string;
  brand?: string;
  /** Free-form qualification answers (purpose, skinType, room, etc). */
  answers?: Record<string, string>;
}

export interface ConversationTurnInput {
  orgId: string;
  orgName: string;
  settings: Pick<OrgSettings, "aiName" | "tone" | "greeting" | "neverSay" | "sellsDescription">;
  messageText: string;
  /** Prior turns, oldest first. Loaded by the caller from persisted Messages. */
  history: ChatMessage[];
  /** Category/budget/brand/answers already collected via the widget's
   *  qualification funnel — grounds chat so the shopper never repeats
   *  themselves after Welcome → Category → Qualification. */
  shoppingContext?: ShoppingContext;
}

export interface ConversationTurnResult {
  replyText: string;
  intent: Intent;
  recommendations: RecommendationOut[];
  inputTokens: number;
  outputTokens: number;
}

function formatShoppingContext(ctx: ShoppingContext | undefined): string | null {
  if (!ctx) return null;
  const parts: string[] = [];
  if (ctx.categoryName) parts.push(`category: ${ctx.categoryName}`);
  if (ctx.budget) parts.push(`budget: ${ctx.budget}`);
  if (ctx.brand) parts.push(`preferred brand: ${ctx.brand}`);
  if (ctx.answers) {
    for (const [key, value] of Object.entries(ctx.answers)) {
      if (key === "budget" || key === "brand" || !value) continue;
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.length ? parts.join(", ") : null;
}

function buildSystemPrompt(
  orgName: string,
  settings: ConversationTurnInput["settings"],
  context: RetrievedContext[],
  shoppingContext?: ShoppingContext
): string {
  const products = context.filter((c): c is Extract<RetrievedContext, { type: "product" }> => c.type === "product");
  const knowledge = context.filter((c): c is Extract<RetrievedContext, { type: "knowledge" }> => c.type === "knowledge");

  const productBlock = products.length
    ? products
        .map((p) => `- id: ${p.id} | ${p.name} | ${p.price}${p.category ? ` | ${p.category}` : ""}${p.description ? ` | ${p.description}` : ""}`)
        .join("\n")
    : "(no matching products found for this query)";

  const knowledgeBlock = knowledge.length
    ? knowledge.map((k) => `- ${k.title}: ${k.content}`).join("\n")
    : "(no matching policy/FAQ found for this query)";

  const shoppingLine = formatShoppingContext(shoppingContext);

  return [
    `You are ${settings.aiName || "the AI shopping assistant"} for ${orgName}, an online store.`,
    settings.sellsDescription ? `What this store sells: ${settings.sellsDescription}` : null,
    `Tone: ${settings.tone || "friendly"}.`,
    settings.neverSay ? `Never say or imply: ${settings.neverSay}` : null,
    settings.greeting ? `Standard greeting style to match: "${settings.greeting}"` : null,
    shoppingLine
      ? `The shopper already told us this through the widget's qualification flow — ${shoppingLine}. Use it to stay relevant and NEVER ask them to repeat it.`
      : null,
    "",
    "You help visitors find products and answer questions using ONLY the information below — never invent prices, stock, shipping details, or policies that aren't listed here. If the answer isn't in the provided context, say you're not sure and offer to connect them with the team.",
    "",
    "CANDIDATE PRODUCTS (only recommend from this list, using the exact id given):",
    productBlock,
    "",
    "STORE POLICIES / FAQ CONTEXT:",
    knowledgeBlock,
    "",
    "Respond with ONLY a JSON object (no markdown, no prose outside the JSON) matching this shape:",
    `{"reply": string, "intent": one of ${JSON.stringify(VALID_INTENTS)}, "recommendedProducts": [{"productId": string, "reason": string}]}`,
    "recommendedProducts should be empty unless you're actually recommending specific products from the candidate list above. Keep reply conversational and concise.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function tryParseModelJson(raw: string): { reply?: unknown; intent?: unknown; recommendedProducts?: unknown } | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Exported so ai-performance analytics can identify these turns as a
 *  real "the model's output couldn't be parsed" signal, rather than
 *  duplicating this literal string elsewhere. */
export const FALLBACK_REPLY_TEXT =
  "Sorry, I'm having a little trouble right now — could you try rephrasing that, or ask again in a moment?";

function safeFallback(inputTokens: number, outputTokens: number): ConversationTurnResult {
  return {
    replyText: FALLBACK_REPLY_TEXT,
    intent: "unknown",
    recommendations: [],
    inputTokens,
    outputTokens,
  };
}

export async function processConversationTurn(
  input: ConversationTurnInput
): Promise<ConversationTurnResult> {
  const queryEmbedding = await embedText(input.messageText);
  const context = await retrieveContext(input.orgId, queryEmbedding);

  const system = buildSystemPrompt(input.orgName, input.settings, context, input.shoppingContext);
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...input.history,
    { role: "user", content: input.messageText },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let parsed: ReturnType<typeof tryParseModelJson> = null;

  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    const attemptMessages =
      attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: "system" as const,
              content: "Your previous response was not valid JSON. Respond again with ONLY a single JSON object matching the required shape — no other text.",
            },
          ];

    const result = await completeJson(attemptMessages);
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    parsed = tryParseModelJson(result.raw);
  }

  if (!parsed || typeof parsed.reply !== "string" || !parsed.reply.trim()) {
    return safeFallback(totalInputTokens, totalOutputTokens);
  }

  const intent: Intent = isValidIntent(parsed.intent) ? parsed.intent : "unknown";

  const productById = new Map(
    context
      .filter((c): c is Extract<RetrievedContext, { type: "product" }> => c.type === "product")
      .map((p) => [p.id, p])
  );

  const rawRecommendations = Array.isArray(parsed.recommendedProducts) ? parsed.recommendedProducts : [];
  const recommendations: RecommendationOut[] = [];
  for (const entry of rawRecommendations) {
    if (!entry || typeof entry !== "object") continue;
    const productId = (entry as Record<string, unknown>).productId;
    const reason = (entry as Record<string, unknown>).reason;
    if (typeof productId !== "string") continue;
    // Only ever trust name/price from the live candidate row — never
    // from the model, even if it echoes them back.
    const product = productById.get(productId);
    if (!product) continue;
    recommendations.push({
      id: product.id,
      name: product.name,
      price: product.price,
      whyThis: typeof reason === "string" && reason.trim() ? reason.trim() : "Matches what you're looking for.",
      url: product.url,
      imageUrl: product.imageUrl,
    });
  }

  return {
    replyText: parsed.reply.trim(),
    intent,
    recommendations: recommendations.slice(0, 3),
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}

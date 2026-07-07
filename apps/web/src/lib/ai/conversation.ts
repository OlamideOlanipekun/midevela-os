import { detectIntent } from "./intent";
import { retrieveContext } from "./rag";
import { generateRecommendations } from "./recommendation";

interface ConversationTurnInput {
  orgId: string;
  customerId: string;
  messageText: string;
  history: Array<{ role: "customer" | "ai"; content: string }>;
}

interface ConversationTurnResult {
  replyText: string;
  intent: string;
  recommendations: any[];
}

/**
 * Executes a single conversational turn orchestration.
 * Chains intent classification, context retrieval, and product match filters.
 */
export async function processConversationTurn(
  input: ConversationTurnInput
): Promise<ConversationTurnResult> {
  const { orgId, messageText } = input;

  // 1. Detect user intent
  const intent = await detectIntent(messageText);

  // 2. Fetch context snippets (RAG)
  const contextMatches = await retrieveContext(orgId, messageText);
  const contextString = contextMatches.map((m) => m.content).join("\n");

  // 3. Match catalog items if discovery or comparing
  let recommendations: any[] = [];
  if (intent === "discovery" || intent === "comparison") {
    recommendations = await generateRecommendations(orgId, {
      descriptionMatch: messageText,
    });
  }

  // 4. Formulate the response (simulating LLM prompt execution loop)
  let replyText = "";

  if (intent === "greeting") {
    replyText = "Good day! Welcome to LuxeStyle NG. How can I guide your shopping decisions today?";
  } else if (intent === "support") {
    if (contextString.includes("Shipping Policy")) {
      replyText = "We offer standard delivery to your location for ₦4,500 taking 3-5 days. Within Lagos, delivery is ₦2,000. Let me know if you would like me to link you to checkout.";
    } else {
      replyText = "We accept standard tags-on returns within 7 days. Serums and skin solutions are final sale due to health codes.";
    }
  } else if (intent === "purchase_ready") {
    replyText = "Superb choice! I have prepared your Paystack checkout link to secure this order: paystack.com/pay/luxestyle-set";
  } else if (recommendations.length > 0) {
    replyText = `Based on your request, I found some products you might like:`;
  } else {
    replyText = "Interesting! Could you clarify if you prefer a specific size, fabric style, or price limit so I can search our catalog?";
  }

  return {
    replyText,
    intent,
    recommendations,
  };
}

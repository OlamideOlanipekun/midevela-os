/**
 * Smart Checkout Assistance (Milestone C16)
 *
 * Answers shopper questions during checkout decision (shipping cost, return policy,
 * delivery duration, payment options) using the Website Intelligence Knowledge Layer.
 */

import prisma from "@/lib/prisma";

export class CheckoutAssistanceEngine {
  static async answerCheckoutQuestion(
    orgId: string,
    question: string
  ): Promise<string | null> {
    const lower = question.toLowerCase();

    const isPolicyQuery =
      lower.includes("shipping") ||
      lower.includes("delivery") ||
      lower.includes("return") ||
      lower.includes("pay") ||
      lower.includes("policy") ||
      lower.includes("refund");

    if (!isPolicyQuery) return null;

    // Retrieve policy entries from Knowledge base
    const knowledgeEntries = await prisma.knowledgeEntry.findMany({
      where: {
        orgId,
        type: "POLICY",
      },
      take: 3,
    });

    if (knowledgeEntries.length > 0) {
      const match = knowledgeEntries.find((entry) => {
        const text = `${entry.title} ${entry.content}`.toLowerCase();
        if (lower.includes("shipping") || lower.includes("delivery")) {
          return text.includes("shipping") || text.includes("delivery");
        }
        if (lower.includes("return") || lower.includes("refund")) {
          return text.includes("return") || text.includes("refund");
        }
        if (lower.includes("pay")) {
          return text.includes("pay") || text.includes("payment");
        }
        return true;
      });

      if (match) {
        return match.content;
      }
    }

    if (lower.includes("shipping") || lower.includes("delivery")) {
      return "Standard delivery typically takes 2-4 business days. Shipping rates depend on your destination location during checkout.";
    }
    if (lower.includes("return") || lower.includes("refund")) {
      return "We accept returns within 7 days of delivery for items in their original, unused condition.";
    }
    if (lower.includes("pay")) {
      return "We support secure card payments and bank transfers via Paystack at checkout.";
    }

    return null;
  }
}

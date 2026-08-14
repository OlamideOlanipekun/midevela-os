import prisma from "@/lib/prisma";

export interface IntentProductConversion {
  productId: string;
  intentKey: string;
  impressions: number;
  clicks: number;
  purchases: number;
  conversionRate: number;
}

export interface ConversationSignalSummary {
  topic: string;
  stage: string;
  sessionCount: number;
  purchaseCount: number;
  conversionRate: number;
}

/**
 * Intent -> Product Learning Engine (E4 + E6)
 * Maps natural language customer intents to historically converting products,
 * and tracks statistical correlations between conversation topics and checkout completion.
 */
export class IntentLearning {
  /**
   * Normalize an raw user query string into a consistent intent key.
   * e.g., "I need running shoes under 100k" -> "running_shoes_under_100k"
   */
  public static normalizeIntentKey(rawQuery: string): string {
    if (!rawQuery) return "general_inquiry";

    const cleaned = rawQuery
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "_");

    return cleaned.slice(0, 100) || "general_inquiry";
  }

  /**
   * Fetch top historically converting products for a specific intent key (E4).
   */
  public static async getTopProductsForIntent(
    orgId: string,
    intentKey: string,
    limit = 5
  ): Promise<IntentProductConversion[]> {
    const normalized = this.normalizeIntentKey(intentKey);

    const performances = await prisma.intentProductPerformance.findMany({
      where: { orgId, intentKey: normalized },
      orderBy: [{ conversionRate: "desc" }, { purchases: "desc" }],
      take: limit,
    });

    return performances.map((p) => ({
      productId: p.productId,
      intentKey: p.intentKey,
      impressions: p.impressions,
      clicks: p.clicks,
      purchases: p.purchases,
      conversionRate: p.conversionRate,
    }));
  }

  /**
   * Analyze conversation topic signals to determine correlations with purchase outcomes (E6).
   */
  public static async getConversationSignals(
    orgId: string
  ): Promise<ConversationSignalSummary[]> {
    const signals = await prisma.conversationSignal.findMany({
      where: { orgId },
      orderBy: { conversionRate: "desc" },
    });

    return signals.map((s) => ({
      topic: s.topic,
      stage: s.stage,
      sessionCount: s.sessionCount,
      purchaseCount: s.purchaseCount,
      conversionRate: s.conversionRate,
    }));
  }
}

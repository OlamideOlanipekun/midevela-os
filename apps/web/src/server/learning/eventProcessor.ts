import prisma from "@/lib/prisma";
import { LearningSignalEvent } from "./types";

/**
 * Event Intelligence Processor (E1 + E15 + E16)
 * Processes positive and negative feedback loops from shopper interactions,
 * updating product performance metrics, intent-product mappings, and conversation signals.
 */
export class EventProcessor {
  /**
   * Process a single learning signal event safely with org_id multi-tenant isolation.
   */
  public static async processEvent(event: LearningSignalEvent): Promise<void> {
    if (!event.orgId) {
      throw new Error("[EventProcessor] Missing mandatory orgId");
    }

    try {
      switch (event.eventType) {
        case "recommendation.impression":
          if (event.productId) {
            await this.recordProductImpression(event.orgId, event.productId, event.intentKey);
          }
          break;

        case "recommendation.click":
          if (event.productId) {
            await this.recordProductClick(event.orgId, event.productId, event.intentKey);
          }
          break;

        case "recommendation.ignored":
          if (event.productId) {
            await this.recordProductIgnored(event.orgId, event.productId);
          }
          break;

        case "cart.add":
          if (event.productId) {
            await this.recordCartAdd(event.orgId, event.productId);
          }
          break;

        case "purchase.complete":
          if (event.productId) {
            await this.recordPurchase(event.orgId, event.productId, event.intentKey, event.conversationTopic);
          }
          break;

        case "order.return":
          if (event.productId) {
            await this.recordReturn(event.orgId, event.productId);
          }
          break;

        default:
          break;
      }
    } catch (err) {
      console.error("[EventProcessor] Error processing event:", err);
      throw err;
    }
  }

  private static async recordProductImpression(orgId: string, productId: string, intentKey?: string): Promise<void> {
    const existing = await prisma.productPerformanceMetric.findUnique({
      where: { orgId_productId: { orgId, productId } },
    });

    const impressions = (existing?.impressions ?? 0) + 1;
    const clicks = existing?.clicks ?? 0;
    const carts = existing?.carts ?? 0;
    const purchases = existing?.purchases ?? 0;
    const returns = existing?.returns ?? 0;

    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cartRate = impressions > 0 ? carts / impressions : 0;
    const conversionRate = impressions > 0 ? purchases / impressions : 0;
    const returnRate = purchases > 0 ? returns / purchases : 0;

    await prisma.productPerformanceMetric.upsert({
      where: { orgId_productId: { orgId, productId } },
      create: {
        orgId,
        productId,
        impressions: 1,
        clicks: 0,
        carts: 0,
        purchases: 0,
        returns: 0,
        ctr: 0,
        cartRate: 0,
        conversionRate: 0,
        returnRate: 0,
      },
      update: {
        impressions,
        ctr,
        cartRate,
        conversionRate,
        returnRate,
      },
    });

    if (intentKey) {
      await prisma.intentProductPerformance.upsert({
        where: { orgId_intentKey_productId: { orgId, intentKey, productId } },
        create: {
          orgId,
          intentKey,
          productId,
          impressions: 1,
          clicks: 0,
          purchases: 0,
          conversionRate: 0,
        },
        update: {
          impressions: { increment: 1 },
        },
      });
    }
  }

  private static async recordProductClick(orgId: string, productId: string, intentKey?: string): Promise<void> {
    const existing = await prisma.productPerformanceMetric.findUnique({
      where: { orgId_productId: { orgId, productId } },
    });

    if (!existing) {
      await this.recordProductImpression(orgId, productId, intentKey);
    }

    const current = await prisma.productPerformanceMetric.findUnique({
      where: { orgId_productId: { orgId, productId } },
    });

    if (!current) return;

    const clicks = current.clicks + 1;
    const ctr = current.impressions > 0 ? clicks / current.impressions : 0;

    await prisma.productPerformanceMetric.update({
      where: { orgId_productId: { orgId, productId } },
      data: {
        clicks,
        ctr,
      },
    });

    if (intentKey) {
      await prisma.intentProductPerformance.upsert({
        where: { orgId_intentKey_productId: { orgId, intentKey, productId } },
        create: {
          orgId,
          intentKey,
          productId,
          impressions: 1,
          clicks: 1,
          purchases: 0,
          conversionRate: 0,
        },
        update: {
          clicks: { increment: 1 },
        },
      });
    }
  }

  private static async recordProductIgnored(orgId: string, productId: string): Promise<void> {
    // Recommendation ignored -> counts as impression without click
    await this.recordProductImpression(orgId, productId);
  }

  private static async recordCartAdd(orgId: string, productId: string): Promise<void> {
    const existing = await prisma.productPerformanceMetric.findUnique({
      where: { orgId_productId: { orgId, productId } },
    });

    if (!existing) {
      await this.recordProductImpression(orgId, productId);
    }

    const current = await prisma.productPerformanceMetric.findUnique({
      where: { orgId_productId: { orgId, productId } },
    });

    if (!current) return;

    const carts = current.carts + 1;
    const cartRate = current.impressions > 0 ? carts / current.impressions : 0;

    await prisma.productPerformanceMetric.update({
      where: { orgId_productId: { orgId, productId } },
      data: {
        carts,
        cartRate,
      },
    });
  }

  private static async recordPurchase(
    orgId: string,
    productId: string,
    intentKey?: string,
    conversationTopic?: string
  ): Promise<void> {
    const existing = await prisma.productPerformanceMetric.findUnique({
      where: { orgId_productId: { orgId, productId } },
    });

    if (!existing) {
      await this.recordProductImpression(orgId, productId);
    }

    const current = await prisma.productPerformanceMetric.findUnique({
      where: { orgId_productId: { orgId, productId } },
    });

    if (!current) return;

    const purchases = current.purchases + 1;
    const conversionRate = current.impressions > 0 ? purchases / current.impressions : 0;
    const returnRate = purchases > 0 ? current.returns / purchases : 0;

    await prisma.productPerformanceMetric.update({
      where: { orgId_productId: { orgId, productId } },
      data: {
        purchases,
        conversionRate,
        returnRate,
      },
    });

    if (intentKey) {
      const intentItem = await prisma.intentProductPerformance.findUnique({
        where: { orgId_intentKey_productId: { orgId, intentKey, productId } },
      });

      const intentPurchases = (intentItem?.purchases ?? 0) + 1;
      const intentImpressions = Math.max(intentItem?.impressions ?? 1, 1);
      const intentConvRate = intentPurchases / intentImpressions;

      await prisma.intentProductPerformance.upsert({
        where: { orgId_intentKey_productId: { orgId, intentKey, productId } },
        create: {
          orgId,
          intentKey,
          productId,
          impressions: 1,
          clicks: 1,
          purchases: 1,
          conversionRate: 1,
        },
        update: {
          purchases: intentPurchases,
          conversionRate: intentConvRate,
        },
      });
    }

    if (conversationTopic) {
      await prisma.conversationSignal.upsert({
        where: { orgId_topic_stage: { orgId, topic: conversationTopic, stage: "PURCHASED" } },
        create: {
          orgId,
          topic: conversationTopic,
          stage: "PURCHASED",
          sessionCount: 1,
          purchaseCount: 1,
          conversionRate: 1.0,
        },
        update: {
          purchaseCount: { increment: 1 },
          sessionCount: { increment: 1 },
        },
      });
    }
  }

  private static async recordReturn(orgId: string, productId: string): Promise<void> {
    const current = await prisma.productPerformanceMetric.findUnique({
      where: { orgId_productId: { orgId, productId } },
    });

    if (!current) return;

    const returns = current.returns + 1;
    const returnRate = current.purchases > 0 ? returns / current.purchases : 0;

    await prisma.productPerformanceMetric.update({
      where: { orgId_productId: { orgId, productId } },
      data: {
        returns,
        returnRate,
      },
    });
  }
}

import { eventBus } from "@/server/events/bus";
import { metricsStore } from "@/server/metrics/store";
import type { MidevelaEvent } from "@/server/events/types";

/**
 * Single consumer that subscribes to all events and updates Redis metrics.
 * This keeps analytics logic in one place — no service touches Redis directly.
 */
export function startMetricsService(): void {
  eventBus.on("conversation.started", async (event) => {
    await metricsStore.incrementLiveConversations();
    await metricsStore.pushActivity({
      action: "conversation.started",
      merchantName: event.merchantName,
      merchantId: event.merchantId,
      metadata: { conversationId: event.conversationId, channel: event.channel },
    });
  });

  eventBus.on("conversation.ended", async () => {
    await metricsStore.decrementLiveConversations();
  });

  eventBus.on("message.sent", async (event) => {
    await metricsStore.recordMessage(event.inputTokens, event.outputTokens);
  });

  eventBus.on("ai.response.generated", async (event) => {
    await metricsStore.recordAIResponse(event.latency, event.confidence, event.tokens);
  });

  eventBus.on("recommendation.made", async () => {
    await metricsStore.incrementRecommendations();
  });

  eventBus.on("purchase.completed", async (event) => {
    await metricsStore.addRevenue(event.amount, event.currency);
    await metricsStore.pushActivity({
      action: "purchase.completed",
      merchantId: event.merchantId,
      metadata: { amount: event.amount, currency: event.currency },
    });
  });

  eventBus.on("merchant.created", async (event) => {
    await metricsStore.incrementMerchantCount();
    await metricsStore.pushActivity({
      action: "merchant.created",
      merchantName: event.merchantName,
      merchantId: event.merchantId,
    });
  });

  eventBus.on("merchant.deleted", async () => {
    await metricsStore.decrementMerchantCount();
  });

  eventBus.on("merchant.suspended", async (event) => {
    await metricsStore.pushActivity({
      action: "merchant.suspended",
      merchantId: event.merchantId,
      metadata: { reason: event.reason },
    });
  });

  eventBus.on("widget.installed", async () => {
    await metricsStore.incrementWidgetInstalled();
  });

  eventBus.on("human.handoff.requested", async (event: any) => {
    await metricsStore.incrementHandoffs();
    await metricsStore.pushActivity({
      action: "handoff.requested",
      merchantId: event.merchantId,
      metadata: { customerName: event.customerName, reason: event.reason },
    });
  });

  eventBus.on("visitor.connected", async (event) => {
    await metricsStore.addVisitor(event.merchantId);
    await metricsStore.recordVisitorCountry(event.country);
  });

  eventBus.on("visitor.disconnected", async (event) => {
    await metricsStore.removeVisitor(event.merchantId);
  });

  eventBus.on("knowledge.indexed", async () => {
    await metricsStore.pushActivity({
      action: "knowledge.indexed",
    });
  });

  eventBus.on("import.completed", async (event) => {
    await metricsStore.pushActivity({
      action: "import.completed",
      merchantId: event.merchantId,
      metadata: { imported: event.imported, skipped: event.skipped, failed: event.failed },
    });
  });

  eventBus.on("payment.succeeded", async (event) => {
    await metricsStore.pushActivity({
      action: "payment.received",
      merchantId: event.merchantId,
      metadata: { amount: event.amount, planCode: event.planCode },
    });
  });

  eventBus.on("payment.failed", async (event) => {
    await metricsStore.pushActivity({
      action: "payment.failed",
      merchantId: event.merchantId,
      metadata: { reason: event.reason },
    });
  });

  eventBus.on("admin.login", async () => {
    await metricsStore.pushActivity({
      action: "admin.login",
    });
  });

  eventBus.on("feature.toggled", async (event) => {
    await metricsStore.pushActivity({
      action: "feature.toggled",
      metadata: { featureKey: event.featureKey, enabled: event.enabled },
    });
  });

  eventBus.on("queue.health", async (event) => {
    await metricsStore.reportQueueHealth(event.queue, event.pending, event.active, event.failed);
  });

  eventBus.on("infrastructure.metric", () => {
    // Store in Redis for dashboard
  });

  console.log("[MetricsService] started — listening for all events");
}

/**
 * Returns a live snapshot from the metrics store.
 */
export async function getLiveMetrics() {
  return metricsStore.getLiveSnapshot();
}

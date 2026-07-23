import { eventBus } from "@/server/events/bus";

export function publishMerchantCreated(merchantId: string, name: string, slug: string): void {
  eventBus.publish("merchant.created", { merchantId, merchantName: name, slug });
}

export function publishMerchantDeleted(merchantId: string): void {
  eventBus.publish("merchant.deleted", { merchantId });
}

export function publishMerchantSuspended(merchantId: string, reason?: string): void {
  eventBus.publish("merchant.suspended", { merchantId, reason });
}

export function publishConversationStarted(
  conversationId: string, merchantId: string, merchantName: string, customerId: string, channel: string
): void {
  eventBus.publish("conversation.started", { conversationId, merchantId, merchantName, customerId, channel });
}

export function publishConversationEnded(conversationId: string, merchantId: string, outcome: string, duration: number): void {
  eventBus.publish("conversation.ended", { conversationId, merchantId, outcome, duration });
}

export function publishMessageSent(conversationId: string, merchantId: string, role: "customer" | "ai" | "system", inputTokens: number, outputTokens: number): void {
  eventBus.publish("message.sent", { conversationId, merchantId, role, inputTokens, outputTokens });
}

export function publishAIResponse(merchantId: string, conversationId: string, latency: number, confidence: number, tokens: number, intent: string): void {
  eventBus.publish("ai.response.generated", { merchantId, conversationId, latency, confidence, tokens, intent });
}

export function publishRecommendation(conversationId: string, merchantId: string, productId: string, productName: string): void {
  eventBus.publish("recommendation.made", { conversationId, merchantId, productId, productName });
}

export function publishPurchaseCompleted(merchantId: string, customerId: string, amount: number, currency: string, productIds: string[]): void {
  eventBus.publish("purchase.completed", { merchantId, customerId, amount, currency, productIds });
}

export function publishPaymentSucceeded(merchantId: string, amount: number, currency: string, planCode: string): void {
  eventBus.publish("payment.succeeded", { merchantId, amount, currency, planCode });
}

export function publishPaymentFailed(merchantId: string, amount: number, reason: string): void {
  eventBus.publish("payment.failed", { merchantId, amount, reason });
}

export function publishKnowledgeIndexed(merchantId: string, entryId: string, entryType: string, chunkCount: number): void {
  eventBus.publish("knowledge.indexed", { merchantId, entryId, entryType, chunkCount });
}

export function publishImportStarted(merchantId: string, source: string, itemCount: number): void {
  eventBus.publish("import.started", { merchantId, source, itemCount });
}

export function publishKnowledgeFailed(merchantId: string, error: string, entryId?: string): void {
  eventBus.publish("knowledge.failed", { merchantId, entryId, error });
}

export function publishImportCompleted(merchantId: string, imported: number, skipped: number, failed: number): void {
  eventBus.publish("import.completed", { merchantId, imported, skipped, failed });
}

export function publishWidgetInstalled(merchantId: string): void {
  eventBus.publish("widget.installed", { merchantId });
}

export function publishHumanHandoff(conversationId: string, merchantId: string, customerName: string, reason: string): void {
  eventBus.publish("human.handoff.requested", { conversationId, merchantId, customerName, reason });
}

export function publishVisitorConnected(merchantId: string, ip: string, country: string): void {
  eventBus.publish("visitor.connected", { merchantId, ip, country });
}

export function publishVisitorDisconnected(merchantId: string): void {
  eventBus.publish("visitor.disconnected", { merchantId });
}

export function publishAdminLogin(adminId: string): void {
  eventBus.publish("admin.login", { adminId });
}

export function publishFeatureToggled(featureKey: string, enabled: boolean): void {
  eventBus.publish("feature.toggled", { featureKey, enabled });
}

export function publishInfrastructureMetric(cpu: number, ram: number, disk: number, label: string): void {
  eventBus.publish("infrastructure.metric", { cpu, ram, disk, label });
}

export function publishQueueHealth(queue: string, pending: number, active: number, failed: number): void {
  eventBus.publish("queue.health", { queue, pending, active, failed });
}

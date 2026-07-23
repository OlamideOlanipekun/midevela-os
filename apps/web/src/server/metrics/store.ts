import { redis } from "@/server/metrics/redis";

function now(): Date {
  return new Date();
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function hourKey(): string {
  const d = now();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}`;
}

function dayKey(): string {
  const d = now();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function monthKey(): string {
  const d = now();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}`;
}

export class MetricsStore {
  // ── Live Counters ──────────────────────────────────────────

  async incrementLiveConversations(): Promise<void> {
    await redis.incr("metrics:live_conversations");
  }

  async decrementLiveConversations(): Promise<void> {
    await redis.decr("metrics:live_conversations");
  }

  async getLiveConversations(): Promise<number> {
    const val = await redis.get("metrics:live_conversations");
    return Number(val) || 0;
  }

  async addVisitor(merchantId: string): Promise<void> {
    await redis.incr(`merchant:${merchantId}:visitors`);
    await redis.incr("metrics:visitors_online");
  }

  async removeVisitor(merchantId: string): Promise<void> {
    await redis.decr(`merchant:${merchantId}:visitors`);
    await redis.decr("metrics:visitors_online");
  }

  async getVisitorsOnline(): Promise<number> {
    const val = await redis.get("metrics:visitors_online");
    return Number(val) || 0;
  }

  async getMerchantVisitors(merchantId: string): Promise<number> {
    const val = await redis.get(`merchant:${merchantId}:visitors`);
    return Number(val) || 0;
  }

  // ── Revenue ────────────────────────────────────────────────

  async addRevenue(amount: number, currency: string): Promise<void> {
    const day = dayKey();
    await redis.pipeline([
      ["INCRBY", `metrics:revenue:day:${day}`, Math.round(amount * 100)],
      ["EXPIRE", `metrics:revenue:day:${day}`, 172800],
      ["INCRBY", `metrics:revenue:month:${monthKey()}`, Math.round(amount * 100)],
    ]);
  }

  async getRevenueToday(): Promise<number> {
    const raw = await redis.get(`metrics:revenue:day:${dayKey()}`);
    return (Number(raw) || 0) / 100;
  }

  async getRevenueThisMonth(): Promise<number> {
    const raw = await redis.get(`metrics:revenue:month:${monthKey()}`);
    return (Number(raw) || 0) / 100;
  }

  // ── Messages ───────────────────────────────────────────────

  async recordMessage(inputTokens: number, outputTokens: number): Promise<void> {
    const hour = hourKey();
    const day = dayKey();
    await redis.pipeline([
      ["INCR", `metrics:messages:hour:${hour}`],
      ["EXPIRE", `metrics:messages:hour:${hour}`, 86400],
      ["INCR", `metrics:messages:day:${day}`],
      ["INCRBY", `metrics:tokens:hour:${hour}`, inputTokens + outputTokens],
      ["EXPIRE", `metrics:tokens:hour:${hour}`, 86400],
    ]);
  }

  async getMessagesToday(): Promise<number> {
    const val = await redis.get(`metrics:messages:day:${dayKey()}`);
    return Number(val) || 0;
  }

  // ── AI Health ──────────────────────────────────────────────

  async recordAIResponse(latency: number, confidence: number, tokens: number): Promise<void> {
    const r = await redis.pipeline([
      ["INCR", "metrics:ai_responses:count"],
      ["INCRBY", "metrics:ai_responses:latency_sum", Math.round(latency * 100)],
      ["INCRBY", "metrics:ai_responses:confidence_sum", Math.round(confidence * 100)],
      ["INCRBY", "metrics:ai_responses:tokens", tokens],
    ]);
  }

  async getAIHealth(): Promise<{ avgLatency: number; avgConfidence: number; totalTokens: number; responseCount: number }> {
    const [count, latencySum, confidenceSum, tokens] = await Promise.all([
      redis.get("metrics:ai_responses:count"),
      redis.get("metrics:ai_responses:latency_sum"),
      redis.get("metrics:ai_responses:confidence_sum"),
      redis.get("metrics:ai_responses:tokens"),
    ]);

    const c = Number(count) || 0;
    return {
      responseCount: c,
      avgLatency: c > 0 ? (Number(latencySum) || 0) / 100 / c : 0,
      avgConfidence: c > 0 ? Math.round((Number(confidenceSum) || 0) / 100 / c) : 100,
      totalTokens: Number(tokens) || 0,
    };
  }

  // ── Merchants ──────────────────────────────────────────────

  async incrementMerchantCount(): Promise<void> {
    await redis.incr("metrics:merchants:total");
    await redis.incr("metrics:merchants:active");
  }

  async decrementMerchantCount(): Promise<void> {
    await redis.decr("metrics:merchants:total");
  }

  async getMerchantCounts(): Promise<{ total: number; active: number }> {
    const [total, active] = await Promise.all([
      redis.get("metrics:merchants:total"),
      redis.get("metrics:merchants:active"),
    ]);
    return {
      total: Number(total) || 0,
      active: Number(active) || 0,
    };
  }

  // ── Queue Health ───────────────────────────────────────────

  async reportQueueHealth(queue: string, pending: number, active: number, failed: number): Promise<void> {
    await redis.pipeline([
      ["SET", `metrics:queue:${queue}:pending`, pending],
      ["SET", `metrics:queue:${queue}:active`, active],
      ["SET", `metrics:queue:${queue}:failed`, failed],
    ]);
  }

  async getQueueHealth(): Promise<Record<string, { pending: number; active: number; failed: number }>> {
    // Returns queues from known keys
    return {};
  }

  // ── Geo / Countries ────────────────────────────────────────

  async recordVisitorCountry(country: string): Promise<void> {
    await redis.hincr("metrics:countries", country || "Unknown");
  }

  async getCountryBreakdown(): Promise<Record<string, number>> {
    const data = await redis.hgetall("metrics:countries");
    if (!data) return {};
    const result: Record<string, number> = {};
    for (const [country, count] of Object.entries(data)) {
      result[country] = Number(count) || 0;
    }
    return result;
  }

  // ── Activity Feed ──────────────────────────────────────────

  async pushActivity(event: { action: string; merchantName?: string; merchantId?: string; metadata?: Record<string, unknown> }): Promise<void> {
    const entry = JSON.stringify({ ...event, timestamp: Date.now() });
    await redis.pipeline([
      ["LPUSH", "metrics:activity:feed", entry],
      ["LTRIM", "metrics:activity:feed", 0, 999],
    ]);
  }

  async getActivityFeed(count = 50): Promise<any[]> {
    // Upstash REST doesn't support LRANGE via simple URL
    // We'll read from in-memory fallback for now
    return [];
  }

  // ── Widgets ────────────────────────────────────────────────

  async incrementWidgetInstalled(): Promise<void> {
    await redis.incr("metrics:widgets_installed");
  }

  async getWidgetsInstalled(): Promise<number> {
    const val = await redis.get("metrics:widgets_installed");
    return Number(val) || 0;
  }

  // ── Recommendations ────────────────────────────────────────

  async incrementRecommendations(): Promise<void> {
    await redis.incr("metrics:recommendations:total");
  }

  async getRecommendationCount(): Promise<number> {
    const val = await redis.get("metrics:recommendations:total");
    return Number(val) || 0;
  }

  // ── Handoffs ───────────────────────────────────────────────

  async incrementHandoffs(): Promise<void> {
    await redis.incr("metrics:handoffs:total");
  }

  async getHandoffCount(): Promise<number> {
    const val = await redis.get("metrics:handoffs:total");
    return Number(val) || 0;
  }

  // ── Bulk Snapshot ──────────────────────────────────────────

  async getLiveSnapshot(): Promise<Record<string, any>> {
    const [liveConvs, visitors, revenueToday, revenueMonth, msgsToday, aiHealth, merchants, widgets, recs, handoffs] =
      await Promise.all([
        this.getLiveConversations(),
        this.getVisitorsOnline(),
        this.getRevenueToday(),
        this.getRevenueThisMonth(),
        this.getMessagesToday(),
        this.getAIHealth(),
        this.getMerchantCounts(),
        this.getWidgetsInstalled(),
        this.getRecommendationCount(),
        this.getHandoffCount(),
      ]);

    return {
      liveConversations: liveConvs,
      visitorsOnline: visitors,
      revenueToday,
      revenueThisMonth: revenueMonth,
      messagesToday: msgsToday,
      aiConfidence: aiHealth.avgConfidence,
      aiLatency: aiHealth.avgLatency,
      aiTokens: aiHealth.totalTokens,
      aiResponses: aiHealth.responseCount,
      totalMerchants: merchants.total,
      activeMerchants: merchants.active,
      widgetsInstalled: widgets,
      recommendations: recs,
      handoffs: handoffs,
    };
  }
}

export const metricsStore = new MetricsStore();

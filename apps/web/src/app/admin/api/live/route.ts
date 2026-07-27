import { NextRequest } from "next/server";
import { eventBus } from "@/server/events/bus";
import { metricsStore } from "@/server/metrics/store";
import { redis } from "@/server/metrics/redis";
import { getAdminSessionUser } from "@/server/admin/auth";

export const dynamic = "force-dynamic";

/**
 * SSE endpoint for the admin dashboard.
 * Streams live metric updates and events to connected admin clients.
 */
export async function GET(req: NextRequest): Promise<Response> {
  // Require admin session
  const admin = await getAdminSessionUser();
  if (!admin) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channels = (searchParams.get("channels") || "dashboard").split(",");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream closed
        }
      };

      // Send initial snapshot
      metricsStore.getLiveSnapshot().then((snapshot) => {
        send({ type: "snapshot", data: snapshot });
      });

      const onEvent = (event: any) => {
        if (!channels.includes("dashboard") && !channels.includes("all")) return;

        // Map event types to SSE messages
        switch (event.type) {
          case "conversation.started":
            metricsStore.getLiveConversations().then((count) => {
              send({ type: "metrics", data: { liveConversations: count } });
              send({ type: "activity", data: { action: "conversation.started", ...event } });
            });
            break;

          case "conversation.ended":
            metricsStore.getLiveConversations().then((count) => {
              send({ type: "metrics", data: { liveConversations: count } });
            });
            break;

          case "message.sent":
            metricsStore.getMessagesToday().then((count) => {
              send({ type: "metrics", data: { messagesToday: count } });
            });
            break;

          case "ai.response.generated":
            metricsStore.getAIHealth().then((health) => {
              send({ type: "metrics", data: { aiConfidence: health.avgConfidence, aiLatency: health.avgLatency } });
            });
            break;

          case "purchase.completed":
            metricsStore.getRevenueToday().then((rev) => {
              send({ type: "metrics", data: { revenueToday: rev } });
            });
            send({ type: "activity", data: { action: "purchase.completed", ...event } });
            break;

          case "merchant.created":
            metricsStore.getMerchantCounts().then((mc) => {
              send({ type: "metrics", data: { totalMerchants: mc.total, activeMerchants: mc.active } });
            });
            send({ type: "activity", data: { action: "merchant.created", merchantName: event.merchantName } });
            break;

          case "visitor.connected":
          case "visitor.disconnected":
            metricsStore.getVisitorsOnline().then((v) => {
              send({ type: "metrics", data: { visitorsOnline: v } });
            });
            break;

          case "recommendation.made":
            metricsStore.getRecommendationCount().then((r) => {
              send({ type: "metrics", data: { recommendations: r } });
            });
            break;

          case "queue.health":
            send({ type: "queue", data: { queue: event.queue, pending: event.pending, active: event.active, failed: event.failed } });
            break;

          default:
            send({ type: "event", data: event });
        }
      };

      eventBus.onAny(onEvent);

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", data: { ts: Date.now() } });
      }, 30000);

      // Cleanup on disconnect
      req.signal.addEventListener("abort", () => {
        eventBus.off("*", onEvent);
        clearInterval(heartbeat);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

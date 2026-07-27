import { NextResponse } from "next/server";
import { addSSEClient, removeSSEClient, broadcastConversationEvent } from "@/lib/conversations/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  let clientId = crypto.randomUUID();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      addSSEClient(clientId, controller);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`));
    },
    cancel() {
      removeSSEClient(clientId);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

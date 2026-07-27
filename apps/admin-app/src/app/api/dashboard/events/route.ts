import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const event = {
          t: Date.now(),
          health: Math.round(90 + Math.random() * 10),
          visits: Math.round(100 + Math.random() * 50),
          convs: Math.round(10 + Math.random() * 20),
          queue: Math.round(Math.random() * 15),
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      send();
      const interval = setInterval(send, 10000);
      controller.enqueue(encoder.encode("retry: 5000\n\n"));
      const cleanup = () => clearInterval(interval);
      (controller as any).cleanup = cleanup;
    },
    cancel(controller: any) {
      if (controller.cleanup) controller.cleanup();
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

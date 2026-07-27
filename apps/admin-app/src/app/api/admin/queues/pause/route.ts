import { NextRequest, NextResponse } from "next/server";
import { pauseQueue, resumeQueue } from "@/lib/queue/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await pauseQueue(body.queue);
  return NextResponse.json(result);
}

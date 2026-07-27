import { NextRequest, NextResponse } from "next/server";
import { resumeQueue } from "@/lib/queue/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await resumeQueue(body.queue);
  return NextResponse.json(result);
}

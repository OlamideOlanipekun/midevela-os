import { NextRequest, NextResponse } from "next/server";
import { retryJob, cancelJob } from "@/lib/queue/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.action === "cancel") {
    await cancelJob(body.id);
  } else {
    await retryJob(body.id);
  }
  return NextResponse.json({ ok: true });
}

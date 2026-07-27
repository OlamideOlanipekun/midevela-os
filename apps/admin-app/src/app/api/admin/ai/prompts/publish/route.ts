import { NextRequest, NextResponse } from "next/server";
import { publishPrompt } from "@/lib/ai/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await publishPrompt(body.promptId, body.version);
  return NextResponse.json(result);
}

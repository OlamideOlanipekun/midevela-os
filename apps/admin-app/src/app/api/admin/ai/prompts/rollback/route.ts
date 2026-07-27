import { NextRequest, NextResponse } from "next/server";
import { rollbackPrompt } from "@/lib/ai/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await rollbackPrompt(body.promptId, body.version);
  if (!result) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  return NextResponse.json(result);
}

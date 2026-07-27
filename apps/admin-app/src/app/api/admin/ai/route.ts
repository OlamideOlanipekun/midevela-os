import { NextResponse } from "next/server";
import { getAIHealth } from "@/lib/ai/service";

export async function GET() {
  const health = await getAIHealth();
  return NextResponse.json(health);
}

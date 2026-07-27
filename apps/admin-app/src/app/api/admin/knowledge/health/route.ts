import { NextResponse } from "next/server";
import { getKnowledgeHealth } from "@/lib/knowledge/service";

export async function GET() {
  const health = await getKnowledgeHealth();
  return NextResponse.json(health);
}

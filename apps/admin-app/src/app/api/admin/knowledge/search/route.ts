import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const results = await searchKnowledge(body);
  return NextResponse.json(results);
}

import { NextRequest, NextResponse } from "next/server";
import { listIntegrations, updateIntegration, testIntegration } from "@/lib/settings/service";

export async function GET() {
  const items = await listIntegrations();
  return NextResponse.json(items);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const item = await updateIntegration(body.id, body);
  return NextResponse.json(item);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.action === "test") {
    const item = await testIntegration(body.id);
    if (!item) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    return NextResponse.json(item);
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

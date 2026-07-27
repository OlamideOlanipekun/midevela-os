import { NextRequest, NextResponse } from "next/server";
import { listAlertRules, createAlertRule, updateAlertRule, deleteAlertRule } from "@/lib/alerts/service";

export async function GET() {
  const data = await listAlertRules();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const rule = await createAlertRule(body);
  return NextResponse.json(rule, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const rule = await updateAlertRule(body.id, body);
  return NextResponse.json(rule);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  await deleteAlertRule(body.id);
  return NextResponse.json({ ok: true });
}

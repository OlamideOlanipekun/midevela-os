import { NextRequest, NextResponse } from "next/server";
import { listEmailTemplates, updateEmailTemplate } from "@/lib/settings/service";

export async function GET() {
  const items = await listEmailTemplates();
  return NextResponse.json(items);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const item = await updateEmailTemplate(body.id, body);
  return NextResponse.json(item);
}

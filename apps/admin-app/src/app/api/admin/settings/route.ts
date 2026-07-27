import { NextRequest, NextResponse } from "next/server";
import { getSettingsDashboard, listConfigs, updateConfig } from "@/lib/settings/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get("dashboard") === "true") {
    return NextResponse.json(await getSettingsDashboard());
  }
  const items = await listConfigs(sp.get("category") || undefined);
  return NextResponse.json(items);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const item = await updateConfig(body.id, body);
  return NextResponse.json(item);
}

import { NextRequest, NextResponse } from "next/server";
import { getHardeningDashboard, listApiKeys, revokeApiKey, listIpRules, deleteIpRule, listRateLimits } from "@/lib/security/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get("dashboard") === "true") return NextResponse.json(await getHardeningDashboard());
  if (sp.get("type") === "api-keys") return NextResponse.json(await listApiKeys(sp.get("activeOnly") === "true"));
  if (sp.get("type") === "ip-rules") return NextResponse.json(await listIpRules());
  if (sp.get("type") === "rate-limits") return NextResponse.json(await listRateLimits());
  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  if (body.type === "api-key") {
    const key = await revokeApiKey(body.id);
    return NextResponse.json(key);
  }
  if (body.type === "ip-rule") {
    await deleteIpRule(body.id);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}

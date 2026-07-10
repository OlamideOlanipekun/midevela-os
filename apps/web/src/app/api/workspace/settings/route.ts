import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { toSettingsResponse, updateOrgSettings } from "@/server/tenancy/org";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const widgetKey = await prisma.widgetKey.findFirst({
      where: { orgId: org.id, active: true },
      select: { publicKey: true },
    });
    return NextResponse.json({
      settings: { ...toSettingsResponse(org), widgetPublicKey: widgetKey?.publicKey ?? null },
    });
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const body = await req.json();
    const updated = await updateOrgSettings(org.id, body);
    return NextResponse.json({
      success: true,
      settings: toSettingsResponse(updated),
    });
  });
}

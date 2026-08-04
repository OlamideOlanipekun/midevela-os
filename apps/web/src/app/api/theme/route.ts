import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { resolveThemeForOrg } from "@/server/branding/resolve";
import { updateMerchantTheme } from "@/server/branding/service";

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const user = await requireUser();
    if (!user.orgId) {
      return jsonError(400, "User has no organization.");
    }

    const theme = await resolveThemeForOrg(user.orgId);
    return NextResponse.json({ success: true, theme });
  }, req);
}

export async function PATCH(req: NextRequest) {
  return withErrorHandling(async () => {
    const user = await requireUser();
    if (!user.orgId) {
      return jsonError(400, "User has no organization.");
    }

    const body = await req.json();
    await updateMerchantTheme(user.orgId, body);
    const theme = await resolveThemeForOrg(user.orgId);

    return NextResponse.json({ success: true, theme });
  }, req);
}

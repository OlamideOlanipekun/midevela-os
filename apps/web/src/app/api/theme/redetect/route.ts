import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { redetectMerchantTheme } from "@/server/branding/service";
import { resolveThemeForOrg } from "@/server/branding/resolve";

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const user = await requireUser();
    if (!user.orgId) {
      return jsonError(400, "User has no organization.");
    }

    await redetectMerchantTheme(user.orgId);
    const theme = await resolveThemeForOrg(user.orgId);

    return NextResponse.json({ success: true, theme });
  }, req);
}

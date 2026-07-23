import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { requireOrg } from "@/server/auth/context";
import { connectWebsite, WebsiteClaimError } from "@/server/website/service";
import { WebsiteErrors } from "@/server/website/constants";

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const { url } = await req.json();

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { success: false, code: "INVALID_URL", message: "A valid URL is required." },
        { status: 400 }
      );
    }

    try {
      const result = await connectWebsite(org.id, { url: url.trim() });
      return NextResponse.json({ success: true, website: result.website });
    } catch (err) {
      if (err instanceof WebsiteClaimError && err.code === WebsiteErrors.WEBSITE_ALREADY_CONNECTED) {
        return NextResponse.json(
          {
            success: false,
            code: "WEBSITE_ALREADY_CONNECTED",
            message: "This website is already connected to another Midevela workspace.",
          },
          { status: 409 }
        );
      }
      throw err;
    }
  });
}

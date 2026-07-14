import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import { listCategoriesForWidget } from "@/server/catalog/categories";

const CATEGORIES_IP_PER_MIN = 30;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** Kept separate from /api/widget/init for a cheap category-only refresh
 *  (e.g. the widget re-checking after being open a long time). */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const widgetKey = req.nextUrl.searchParams.get("key");
    if (!widgetKey) {
      return NextResponse.json({ error: "key is required." }, { status: 400, headers });
    }

    const ipLimit = await rateLimit(`wcat:ip:${clientIp(req.headers)}`, CATEGORIES_IP_PER_MIN, 60);
    if (!ipLimit.ok) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429, headers });
    }

    const key = await resolveWidgetKey(widgetKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid widget key." }, { status: 401, headers });
    }
    if (!isOriginAllowed(key.allowedDomains, origin)) {
      return NextResponse.json({ error: "Origin not allowed for this widget key." }, { status: 403, headers });
    }

    const categories = await listCategoriesForWidget(key.orgId);
    return NextResponse.json({ categories }, { headers });
  } catch (err) {
    console.error("Widget categories error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers });
  }
}

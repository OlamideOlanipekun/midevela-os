import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { defaultOrgSettings, type OrgSettings } from "@/server/tenancy/org";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import { listCategoriesForWidget } from "@/server/catalog/categories";

// Cheap (one DB read + a category query), but still public.
const INIT_IP_PER_MIN = 30;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Single bootstrap round-trip for the v1.0 widget: business/theme/greeting
 * (same contract as /api/widget/config) plus the category grid for the
 * Welcome Card. /api/widget/categories stays available separately for a
 * cheap refresh without re-fetching everything.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const widgetKey = req.nextUrl.searchParams.get("key");
    if (!widgetKey) {
      return NextResponse.json({ error: "key is required." }, { status: 400, headers });
    }

    const ipLimit = await rateLimit(`wi:ip:${clientIp(req.headers)}`, INIT_IP_PER_MIN, 60);
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

    const stored = (key.org.settings ?? {}) as Partial<OrgSettings>;
    const settings = { ...defaultOrgSettings, ...stored };
    const categories = await listCategoriesForWidget(key.orgId);

    return NextResponse.json(
      {
        business: { name: key.org.name, currency: key.org.currency },
        theme: { accentColor: settings.accentColor },
        greeting: settings.greeting,
        aiName: settings.aiName,
        settings: {
          engagementDelay: settings.engagementDelay,
          showProductImages: settings.features?.showProductImages ?? true,
          exitIntent: settings.features?.exitIntent ?? true,
        },
        categories,
      },
      { headers }
    );
  } catch (err) {
    console.error("Widget init error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers });
  }
}

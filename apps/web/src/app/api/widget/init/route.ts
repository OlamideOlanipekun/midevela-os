import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { defaultOrgSettings, type OrgSettings } from "@/server/tenancy/org";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import { listCategoriesForWidget } from "@/server/catalog/categories";
import { getRecentShoppingCategory } from "@/server/conversations/conversations";

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

    // Returning-visitor hint: the category (if any) this visitor was
    // recently shopping for, sourced from their own conversation history —
    // never trusted blindly, only surfaced if it still matches a real,
    // live category (not deleted/renamed since).
    const customerId = req.nextUrl.searchParams.get("customerId");
    let lastCategory = null;
    if (customerId && customerId.trim().length <= 128) {
      const recent = await getRecentShoppingCategory(key.orgId, customerId.trim());
      if (recent) {
        const match = categories.find((c) => c.id === recent.id);
        if (match) lastCategory = { id: match.id, name: match.name, icon: match.icon, image: match.image };
      }
    }

    const { resolveThemeForOrg } = await import("@/server/branding/resolve");
    const fullTheme = await resolveThemeForOrg(key.orgId);

    return NextResponse.json(
      {
        business: { name: fullTheme.businessName || key.org.name, currency: key.org.currency },
        theme: {
          accentColor: fullTheme.header || settings.accentColor,
          primary: fullTheme.primary,
          secondary: fullTheme.secondary,
          accent: fullTheme.accent,
          header: fullTheme.header,
          launcher: fullTheme.launcher,
          userBubble: fullTheme.userBubble,
          assistantBubble: fullTheme.assistantBubble,
          background: fullTheme.background,
          quickReply: fullTheme.quickReply,
          border: fullTheme.border,
          fontFamily: fullTheme.fontFamily,
          borderRadius: fullTheme.borderRadius,
          onPrimary: fullTheme.onPrimary,
          logoUrl: fullTheme.logoUrl,
          launcherStyle: fullTheme.launcherStyle,
          position: fullTheme.position,
          animation: fullTheme.animation,
          launcherSize: fullTheme.launcherSize,
          headerHeight: fullTheme.headerHeight,
        },
        greeting: settings.greeting,
        aiName: fullTheme.assistantName || settings.aiName,
        settings: {
          engagementDelay: settings.engagementDelay,
          showProductImages: settings.features?.showProductImages ?? true,
          exitIntent: settings.features?.exitIntent ?? true,
        },
        categories,
        lastCategory,
      },
      { headers }
    );
  } catch (err) {
    console.error("Widget init error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { defaultOrgSettings, type OrgSettings } from "@/server/tenancy/org";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";

// Cheap endpoint (one DB read), but still public — bound how fast a single
// IP can hammer it.
const CONFIG_IP_PER_MIN = 30;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Public widget bootstrap config. Returns only presentation-safe settings —
 * never internal prompt config (neverSay, sellsDescription) or channel
 * credentials. Auth semantics mirror /api/widget/message: the public key
 * resolves to an org server-side, and the Origin allowlist applies.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const widgetKey = req.nextUrl.searchParams.get("key");
    if (!widgetKey) {
      return NextResponse.json({ error: "key is required." }, { status: 400, headers });
    }

    const ipLimit = await rateLimit(`wc:ip:${clientIp(req.headers)}`, CONFIG_IP_PER_MIN, 60);
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

    const { resolveThemeForOrg } = await import("@/server/branding/resolve");
    const fullTheme = await resolveThemeForOrg(key.orgId);

    return NextResponse.json(
      {
        orgName: fullTheme.businessName || key.org.name,
        aiName: fullTheme.assistantName || settings.aiName,
        greeting: settings.greeting,
        accentColor: fullTheme.header || settings.accentColor,
        theme: fullTheme,
        engagementDelay: settings.engagementDelay,
        showProductImages: settings.features?.showProductImages ?? true,
      },
      { headers }
    );
  } catch (err) {
    console.error("Widget config error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers });
  }
}

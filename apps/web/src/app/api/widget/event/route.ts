import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import prisma from "@/lib/prisma";

// Fires often during a session (every funnel step) — generous but bounded.
const EVENT_IP_PER_MIN = 120;
const MAX_EVENT_TYPE_LENGTH = 60;
const MAX_PAGE_URL_LENGTH = 2000;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Widget funnel analytics: widget_opened, category_selected,
 * budget_selected, qualification_answered, recommendation_shown,
 * recommendation_clicked, product_viewed, conversation_started,
 * comparison_viewed, checkout_clicked, widget_dismissed. Stored as
 * CustomerEvent rows — the existing model, not a new one.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await req.json();
    const { widgetKey, customerId, eventType, metadata, pageUrl } = body ?? {};

    if (!widgetKey || typeof widgetKey !== "string") {
      return NextResponse.json({ error: "widgetKey is required." }, { status: 400, headers });
    }
    if (!eventType || typeof eventType !== "string" || eventType.length > MAX_EVENT_TYPE_LENGTH) {
      return NextResponse.json({ error: "A valid eventType is required." }, { status: 400, headers });
    }

    const ipLimit = await rateLimit(`we:ip:${clientIp(req.headers)}`, EVENT_IP_PER_MIN, 60);
    if (!ipLimit.ok) {
      // Analytics is best-effort — drop silently rather than error the widget.
      return NextResponse.json({ success: true }, { headers });
    }

    const key = await resolveWidgetKey(widgetKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid widget key." }, { status: 401, headers });
    }
    if (!isOriginAllowed(key.allowedDomains, origin)) {
      return NextResponse.json({ error: "Origin not allowed for this widget key." }, { status: 403, headers });
    }

    const trimmedCustomerId = typeof customerId === "string" && customerId.trim().length <= 128 ? customerId.trim() : "";
    const externalId = trimmedCustomerId || `anon-${crypto.randomUUID()}`;

    const customer = await prisma.customer.upsert({
      where: { orgId_externalId: { orgId: key.orgId, externalId } },
      update: { lastSeen: new Date() },
      create: { orgId: key.orgId, externalId, buyingStage: "EXPLORING" },
    });

    await prisma.customerEvent.create({
      data: {
        orgId: key.orgId,
        customerId: customer.id,
        eventType,
        pageUrl: typeof pageUrl === "string" ? pageUrl.slice(0, MAX_PAGE_URL_LENGTH) : null,
        metadata: metadata && typeof metadata === "object" ? metadata : {},
      },
    });

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    // Analytics must never break the widget experience.
    console.error("Widget event error:", err);
    return NextResponse.json({ success: true }, { headers });
  }
}

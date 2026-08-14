import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import prisma from "@/lib/prisma";
import { customerIntelligence, BehavioralEventType } from "@/server/customerIntelligence";

function mapToCustomerIntelligenceEvent(rawEvent: string): BehavioralEventType {
  const e = rawEvent.toUpperCase();
  if (e === "PAGE_VIEWED" || e === "PAGE_VIEW") return "PAGE_VIEW";
  if (e === "SEARCH_PERFORMED" || e === "SEARCH") return "SEARCH";
  if (e === "PRODUCT_VIEWED" || e === "PRODUCT_VIEW") return "PRODUCT_VIEW";
  if (e === "PRODUCT_CLICKED" || e === "PRODUCT_CLICK") return "PRODUCT_CLICK";
  if (e === "PRODUCT_ADDED_TO_CART" || e === "PRODUCT_ADDED") return "PRODUCT_ADDED";
  if (e === "CHECKOUT_STARTED") return "CHECKOUT_STARTED";
  if (e === "COMPARISON_VIEWED" || e === "PRODUCT_COMPARE") return "PRODUCT_COMPARE";
  if (e === "CHECKOUT_CLICKED" || e === "CHECKOUT_ABANDONED") return "CHECKOUT_ABANDONED";
  if (e === "PURCHASE") return "PURCHASE";
  if (e === "RECOMMENDATION_SHOWN" || e === "PRODUCT_RECOMMENDED") return "PRODUCT_RECOMMENDED";
  return "PAGE_VIEW";
}

// Fires often during a session (every funnel step) — generous but bounded.
const EVENT_IP_PER_MIN = 120;
const MAX_EVENT_TYPE_LENGTH = 60;
const MAX_PAGE_URL_LENGTH = 2000;

/**
 * Milestone A canonical event types (A10 — Analytics Foundation).
 *
 * The widget MUST use exactly these strings for the 8 core funnel events.
 * Unknown event types are still stored (forward-compat) but are flagged
 * so we can detect and fix instrumentation drift early.
 */
const MILESTONE_A_EVENTS = new Set([
  // Core A10 events
  "SESSION_STARTED",
  "PAGE_VIEWED",
  "SEARCH_PERFORMED",
  "PRODUCT_VIEWED",
  "PRODUCT_CLICKED",
  "PRODUCT_ADDED_TO_CART",
  "NAVIGATION_REQUESTED",
  "CHECKOUT_STARTED",
  // Legacy widget-internal events (kept for backwards compat)
  "widget_opened",
  "widget_dismissed",
  "category_selected",
  "budget_selected",
  "qualification_answered",
  "recommendation_shown",
  "recommendation_clicked",
  "product_viewed",
  "comparison_viewed",
  "checkout_clicked",
  "conversation_started",
]);

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

    const sessionId = metadata?.sessionId || `sess-${externalId}`;
    const safePageUrl = typeof pageUrl === "string" ? pageUrl.slice(0, MAX_PAGE_URL_LENGTH) : undefined;

    // Process event through Customer Intelligence Engine
    await customerIntelligence.recordEvent({
      orgId: key.orgId,
      sessionId,
      customerId: customer.id,
      eventType: mapToCustomerIntelligenceEvent(eventType),
      pageUrl: safePageUrl,
      productId: metadata?.productId,
      categoryId: metadata?.categoryId,
      brand: metadata?.brand,
      searchQuery: metadata?.searchQuery,
      filterConstraints: metadata?.filterConstraints,
      comparedProductIds: metadata?.comparedProductIds,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });

    // Observability: warn on unrecognised event types so instrumentation drift
    // is visible in server logs without breaking anything for the shopper.
    if (!MILESTONE_A_EVENTS.has(eventType)) {
      console.warn(`[Widget Event] Unknown eventType "${eventType}" from org ${key.orgId}. Consider adding it to MILESTONE_A_EVENTS.`);
    }

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    // Analytics must never break the widget experience.
    console.error("Widget event error:", err);
    return NextResponse.json({ success: true }, { headers });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { resolveWidgetKey, isOriginAllowed, corsHeaders } from "@/server/conversation/widgetAuth";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import { customerIntelligence } from "@/server/customerIntelligence";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * PWA Real-Time Shopper State Synchronization Endpoint (D16 & D17).
 * Receives page state, active product, category, selected variant, cart state, and navigation context.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await req.json();
    const {
      widgetKey,
      sessionId,
      customerId,
      pageUrl,
      pageType,
      activeProductId,
      activeCategoryId,
      activeCategoryName,
      selectedVariantId,
      searchQuery,
      cartState,
    } = body ?? {};

    if (!widgetKey || typeof widgetKey !== "string") {
      return NextResponse.json({ error: "widgetKey is required." }, { status: 400, headers });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400, headers });
    }

    const ipLimit = await rateLimit(`sync:ip:${clientIp(req.headers)}`, 120, 60);
    if (!ipLimit.ok) {
      return NextResponse.json({ success: true }, { headers });
    }

    const key = await resolveWidgetKey(widgetKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid widget key." }, { status: 401, headers });
    }
    if (!isOriginAllowed(key.allowedDomains, origin)) {
      return NextResponse.json({ error: "Origin not allowed for this widget key." }, { status: 403, headers });
    }

    // Get current session state
    const sessionState = await customerIntelligence.getSessionState(key.orgId, sessionId, customerId);

    // Update page context and session state
    const updatedPageContext = {
      pageUrl,
      pageType,
      activeProductId,
      activeCategoryId,
      activeCategoryName,
      selectedVariantId,
      searchQuery,
    };

    const updatedSession = await customerIntelligence.updateSessionState(key.orgId, sessionId, {
      pageContext: updatedPageContext,
      customerId: customerId || sessionState.customerId || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        sessionState: {
          sessionId: updatedSession.sessionId,
          journeyState: updatedSession.journeyState,
          intentStage: updatedSession.intentStage,
          segment: updatedSession.segment,
          shortlistCount: updatedSession.shortlist.length,
        },
      },
      { headers }
    );
  } catch (err) {
    console.error("State sync error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers });
  }
}
